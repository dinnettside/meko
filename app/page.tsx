import { MakeVideo } from "@/components/MakeVideo";
import { demoCodeRequired } from "@/lib/demo-code";
import { loadFeedItems } from "@/lib/feed";

// The start page shows the first three videos of the feed under the form.
export default async function Home() {
  const featured = (await loadFeedItems()).slice(0, 3);
  return <MakeVideo codeRequired={demoCodeRequired()} featured={featured} />;
}
