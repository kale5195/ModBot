import { Link, Outlet, useParams } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export default function Screen() {
  const { id } = useParams();
  return (
    <main className={cn("w-full max-w-4xl px-8 mx-auto min-h-screen flex flex-col pb-[200px] overflow-hidden")}>
      <nav className="w-full flex justify-between max-w-4xl mx-auto py-8">
        <Link to="/channels" className="no-underline">
          <h1 className="logo text-3xl">ModBot</h1>
        </Link>
        <div className="flex space-x-4">
          <Button asChild>
            <Link className="no-underline" to="/~">
              Dashboard
            </Link>
          </Button>
        </div>
      </nav>
      <Outlet />
    </main>
  );
}
