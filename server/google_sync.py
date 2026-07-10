import datetime
import os
from zoneinfo import ZoneInfo

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

TZ = ZoneInfo("Europe/Kyiv")
SCOPES = ["https://www.googleapis.com/auth/calendar"]


def is_configured():
    return bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET"))


def _redirect_uri():
    return os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5050/api/google/callback")


def build_flow():
    client_config = {
        "web": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [_redirect_uri()],
        }
    }
    return Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=_redirect_uri())


def save_credentials(db, user_id, creds):
    expiry = creds.expiry.isoformat() if creds.expiry else None
    scope = " ".join(creds.scopes or SCOPES)
    existing = db.execute("SELECT refresh_token FROM google_accounts WHERE user_id = ?", (user_id,)).fetchone()
    refresh_token = creds.refresh_token or (existing["refresh_token"] if existing else None)
    db.execute(
        """INSERT INTO google_accounts (user_id, access_token, refresh_token, token_expiry, scope)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             access_token = excluded.access_token,
             refresh_token = excluded.refresh_token,
             token_expiry = excluded.token_expiry,
             scope = excluded.scope""",
        (user_id, creds.token, refresh_token, expiry, scope),
    )
    db.commit()


def get_credentials_for_user(db, user_id):
    row = db.execute("SELECT * FROM google_accounts WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return None
    creds = Credentials(
        token=row["access_token"],
        refresh_token=row["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        scopes=SCOPES,
    )
    if row["token_expiry"]:
        try:
            creds.expiry = datetime.datetime.fromisoformat(row["token_expiry"])
        except ValueError:
            pass
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleAuthRequest())
        save_credentials(db, user_id, creds)
    return creds


def get_freebusy_for_day(creds, date_str):
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    day = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    start = datetime.datetime.combine(day, datetime.time(0, 0), tzinfo=TZ)
    end = datetime.datetime.combine(day, datetime.time(23, 59, 59), tzinfo=TZ)
    body = {
        "timeMin": start.isoformat(),
        "timeMax": end.isoformat(),
        "items": [{"id": "primary"}],
    }
    result = service.freebusy().query(body=body).execute()
    busy_raw = result.get("calendars", {}).get("primary", {}).get("busy", [])
    busy = []
    for b in busy_raw:
        start_dt = datetime.datetime.fromisoformat(b["start"]).astimezone(TZ)
        end_dt = datetime.datetime.fromisoformat(b["end"]).astimezone(TZ)
        busy.append({
            "title": "Зайнято",
            "start_time": start_dt.strftime("%H:%M"),
            "end_time": end_dt.strftime("%H:%M"),
            "type": "google",
        })
    return busy


def sync_task_to_google(db, task_row):
    """Create/update/delete the Google Calendar event that mirrors this task.
    Silently no-ops if the owner hasn't connected Google, or on any API error
    (Google sync is best-effort and must never break task CRUD)."""
    try:
        creds = get_credentials_for_user(db, task_row["owner_id"])
        if not creds:
            return

        service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        has_schedule = (
            task_row["status"] not in ("ideas", None)
            and task_row["start_date"]
            and task_row["start_time"]
        )
        event_id = task_row["google_event_id"]

        if not has_schedule:
            if event_id:
                try:
                    service.events().delete(calendarId="primary", eventId=event_id).execute()
                except Exception:
                    pass
                db.execute("UPDATE tasks SET google_event_id = NULL WHERE id = ?", (task_row["id"],))
                db.commit()
            return

        duration = task_row["planned_minutes"] or 30
        start = datetime.datetime.strptime(
            f"{task_row['start_date']} {task_row['start_time']}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=TZ)
        end = start + datetime.timedelta(minutes=duration)
        body = {
            "summary": task_row["title"],
            "description": task_row["description"] or "",
            "start": {"dateTime": start.isoformat()},
            "end": {"dateTime": end.isoformat()},
        }
        if event_id:
            service.events().update(calendarId="primary", eventId=event_id, body=body).execute()
        else:
            created = service.events().insert(calendarId="primary", body=body).execute()
            db.execute("UPDATE tasks SET google_event_id = ? WHERE id = ?", (created["id"], task_row["id"]))
            db.commit()
    except Exception as exc:
        print(f"[google_sync] failed to sync task {task_row['id']}: {exc}")


def delete_task_event(db, task_row):
    if not task_row["google_event_id"]:
        return
    try:
        creds = get_credentials_for_user(db, task_row["owner_id"])
        if not creds:
            return
        service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        service.events().delete(calendarId="primary", eventId=task_row["google_event_id"]).execute()
    except Exception as exc:
        print(f"[google_sync] failed to delete event for task {task_row['id']}: {exc}")
