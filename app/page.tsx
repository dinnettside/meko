import { MakeVideo } from "@/components/MakeVideo";
import { demoCodeRequired } from "@/lib/demo-code";

export default function Home() {
  return <MakeVideo codeRequired={demoCodeRequired()} />;
}
