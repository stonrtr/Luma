import { SearchClient } from "@/components/SearchClient";

export default function SearchPage() {
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Поиск</h1>
        <p className="page-sub">По всей базе — точным словом или обычным языком по смыслу</p>
      </div>
      <SearchClient />
    </div>
  );
}
