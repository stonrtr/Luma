"use server";

import { requireUser } from "@/server/dal";
import { searchEverything, type SearchResults } from "@/server/queries/search";

export async function globalSearch(q: string): Promise<SearchResults> {
  const user = await requireUser();
  return searchEverything(user.id, user.role, q);
}
