import { Suspense } from "react";
import InboxesClient from "./InboxesClient";

export default function InboxesPage() {
  return (
    <Suspense>
      <InboxesClient />
    </Suspense>
  );
}
