import { redirect } from "next/navigation";

export default function EntryManagerRootPage() {
  redirect("/entry-manager/check-in");
}
