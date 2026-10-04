import HomeView from "@/components/ui/home";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";


export default async function Home() {
  

  return (
    <>
      <HomeView />
    </>

  );
}
