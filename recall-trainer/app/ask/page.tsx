import { AskClient } from "@/components/AskClient";

export default function AskPage() {
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Спросить мою базу</h1>
        <p className="page-sub">AI отвечает по вашим знаниям и ссылается на источники</p>
      </div>
      <AskClient />
    </div>
  );
}
