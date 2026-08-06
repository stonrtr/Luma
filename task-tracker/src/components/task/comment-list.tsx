import { formatDateTime } from "@/lib/format";
import { UserAvatar } from "@/components/ui/user-avatar";

type CommentItem = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

export function CommentList({ comments }: { comments: CommentItem[] }) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Комментариев пока нет.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-md border p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <UserAvatar
                name={comment.author.name}
                avatarUrl={comment.author.avatarUrl}
              />
              {comment.author.name}
            </span>
            <span>{formatDateTime(comment.createdAt)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
        </div>
      ))}
    </div>
  );
}
