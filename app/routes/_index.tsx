import { AuthKitProvider, SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { ClientOnly } from "remix-utils/client-only";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart,
  Bot,
  DollarSign,
  HeartHandshake,
  Loader2,
  Plug,
  Users,
} from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { authenticator } from "~/lib/auth.server";
import { getSharedEnv } from "~/lib/utils.server";
import { Farcaster } from "~/components/icons/farcaster";
import { useCallback, useState } from "react";
import invariant from "tiny-invariant";
import { FarcasterIcon } from "~/components/FarcasterIcon";
import { User } from "@prisma/client";

export const meta: MetaFunction<typeof loader> = (data) => {
  return [
    { title: "ModBot - Farcaster Channel Moderation Helper" },
    { property: "og:title", content: "ModBot - Farcaster Channel Moderation Helper" },
    {
      name: "description",
      content: "Automate channel moderation with customizable rules and team-based moderation.",
    },
    {
      property: "og:description",
      content: "Automate channel moderation with customizable rules and team-based moderation.",
    },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "ModBot - Farcaster Channel Moderation Helper" },
    {
      name: "twitter:description",
      content: "Automate channel moderation with customizable rules and team-based moderation.",
    },
    { property: "og:image", content: `${data.data.env.hostUrl}/logo.png` },
    { name: "twitter:image", content: `${data.data.env.hostUrl}/logo.png` },
    { property: "og:url", content: data.data.env.hostUrl },
    { property: "og:type", content: "website" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const invite = url.searchParams.get("invite");

  if (code) {
    return await authenticator.authenticate("otp", request, {
      successRedirect: "/~",
      failureRedirect: "/login?error=invalid-otp",
    });
  }

  const user = await authenticator.isAuthenticated(request);

  return typedjson({
    env: getSharedEnv(),
    user,
    invite,
    error,
  });
}

export default function Home() {
  const { user, env, error } = useTypedLoaderData<typeof loader>();

  return (
    <main
      className="w-full h-full relative"
      style={{
        backgroundImage:
          "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
      }}
    >
      <div className="w-full h-full z-10 relative">
        {/* hero */}
        <div className="flex flex-col items-center justify-center space-y-6 p-7 pb-10 pt-20">
          <section className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl logo text-white mb-4">ModBot</h1>
            <div className="py-4 sm:py-8">
              <h1
                className="text-center text-5xl sm:text-6xl text-[#f9ffd9] tracking-tighter leading-1"
                style={{
                  fontFamily: "Rubik",
                  fontWeight: 700,
                }}
              >
                Put your channel on autopilot.
              </h1>
              <p className="text-white/80 text-md sm:text-xl mt-2 max-w-2xl mx-auto">
                Choose from 20+ composable rules to automatically invite great people to your channel.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center">
              <LoginButton user={user} error={error} env={env} />
            </div>

            <section className="flex flex-col items-center mt-12">
              <p className="mb-2 text-[#f9ffd9]/80 text-sm">
                Built on top of{" "}
                <a href="https://automod.sh" className="text-white no-underline" rel="noreferrer" target="_blank">
                  automod
                </a>{" "}
                by{" "}
                <a
                  href="https://warpcast.com/jtgi"
                  className="text-white no-underline"
                  rel="noreferrer"
                  target="_blank"
                >
                  @jtgi
                </a>{" "}
              </p>
              {/* <div className="flex -space-x-1">
                {activeChannels
                  .filter((c) => !!c.imageUrl)
                  .map((channel, index) => {
                    return (
                      <Popover key={channel.id}>
                        <PopoverTrigger
                          className="hover:-translate-y-1 transition-all duration-400 z-auto"
                          style={{
                            zIndex: index,
                          }}
                        >
                          <img
                            key={channel.id}
                            src={channel.imageUrl ?? undefined}
                            className="inline-block shrink-0 h-8 w-8 rounded-full ring-2 ring-white"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="flex gap-1 p-1 pr-4 rounded-full items-center w-auto">
                          <img
                            src={channel.imageUrl ?? "/icons/modbot.png"}
                            className="h-8 w-8 rounded-full block flex-1"
                          />
                          <div>
                            <h3 className="text-sm font-bold font-mono" style={{ fontFamily: "Kode Mono" }}>
                              /{channel.id}
                            </h3>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
              </div> */}
            </section>

            <section className="flex flex-col items-center mt-4">
              <Link to="/channels">
                <p className="mb-2 text-[#f9ffd9]/80 text-sm">
                  check all <FarcasterIcon className="-mt-[2px] inline w-3 h-3 text-white/80" /> channels using modbot
                </p>
              </Link>
            </section>
          </section>
        </div>

        {/* features */}
        <div className="p-7 pt-8 pb-24 sm:px-12">
          <div className="justify-left mx-auto flex max-w-5xl flex-col items-center space-y-6">
            <div className="grid grid-cols-1 gap-14 gap-y-12 sm:grid-cols-2 sm:gap-12">
              <FeatureCard
                Icon={BadgeDollarSign}
                title="Token gate your channel"
                description="Full support for ERC-721, ERC-1155, and ERC-20 tokens across all major networks."
              />
              <FeatureCard
                Icon={Bot}
                title="Fully customizable moderation rules"
                description="20+ composable rules to automatically filter out and promote meaningful content in your channel."
              />
              {/* <FeatureCard
                Icon={Users}
                title="Team based moderation"
                description="Distribute work between teammates and community members with Moderation Roles."
              /> */}
              {/* <FeatureCard
                Icon={MagicWandIcon}
                title="Moderate directly in Warpcast"
                description="Use cast actions to ban, hide, curate, or whitelist any account, directly in Warpcast."
              /> */}
              <FeatureCard
                Icon={Plug}
                title="Farcaster native integrations"
                description="Support for Hypersub, Paragraph, OpenRank, Icebreaker, Warpcast and more."
              />
              <FeatureCard
                Icon={HeartHandshake}
                title="Collaborate with Teams"
                description="Grant your teammates access to your channel and work together to moderate your community."
              />
              <FeatureCard
                Icon={BarChart}
                title="Measure your success"
                description="Real time analytics to help you understand how your community is growing and how your moderation is performing."
              />
              <FeatureCard
                Icon={DollarSign}
                title="Generous pricing"
                description="ModBot has a generous free tier fit for 90% of channels on Farcaster."
              />
            </div>
          </div>
        </div>

        <footer
          className="p-7 text-xs py-12 w-full"
          style={{
            backgroundImage:
              "radial-gradient( circle farthest-corner at 10% 20%,  rgba(10,3,32,0.87) 20.8%, rgba(10,10,35,0.84) 74.4% )",
          }}
        >
          <div className="max-w-5xl mx-auto flex justify-between flex-col gap-4 sm:flex-row">
            <p className="flex items-center gap-4">
              {/* <Link to="/disclosure" className="text-white/40 no-underline">
                Disclosure
              </Link> */}
              <Link to="/privacy" className="text-white/40 no-underline">
                Privacy
              </Link>
              <Link to="/tos" className="text-white/40 no-underline">
                Terms
              </Link>
              <Link to="https://github.com/kale5195/automod" className="text-white/40 no-underline">
                Github
              </Link>
            </p>
            <p style={{ fontFamily: "Kode Mono" }} className="text-white/20">
              Built upon the great work by{" "}
              <a href="https://warpcast.com/jtgi" className="text-white/40 no-underline">
                @jtgi
              </a>
            </p>
          </div>
        </footer>
      </div>
      <FarcasterIcon className="w-full justify-center items-center h-screen absolute -top-12 left-0 opacity-5 mix-blend-multiply" />
    </main>
  );
}

function FeatureCard(props: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <div className="flex flex-row items-start justify-normal gap-x-4 space-y-2 sm:text-left text-[#f9ffd9]">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full bg-orange-100/20">
        <props.Icon className="h-8 w-8" />
      </div>
      <div>
        <p className="font-semibold text-white">{props.title}</p>
        <p className="text-[#f9ffd9]/60">{props.description}</p>
      </div>
    </div>
  );
}

export function LoginButton(props: { user: User | null; error: string | null; env: ReturnType<typeof getSharedEnv> }) {
  const { user, error, env } = props;
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();

  const farcasterConfig = {
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${env.infuraProjectId}`,
    domain: new URL(env.hostUrl).host.split(":")[0],
    siweUri: `${env.hostUrl}/login`,
  };

  const handleSuccess = useCallback((res: StatusAPIResponse) => {
    setLoggingIn(true);
    invariant(res.message, "message is required");
    invariant(res.signature, "signature is required");
    invariant(res.nonce, "nonce is required");

    const params = new URLSearchParams();
    params.append("message", res.message);
    params.append("signature", res.signature);
    params.append("nonce", res.nonce);
    res.username && params.append("username", res.username);
    res.pfpUrl && params.append("pfpUrl", res.pfpUrl);

    navigate(`/auth/farcaster?${params}`, {
      replace: true,
    });
  }, []);

  return (
    <section className="flex flex-col items-center mt-8 w-full">
      {error && (
        <Alert className="mb-8" variant="destructive">
          {error}
        </Alert>
      )}

      {user ? (
        <Button
          asChild
          className="no-underline relative w-full sm:w-[250px] text-white/80 hover:text-white/100 border-black active:translate-y-[2px] bg-slate-800/80 hover:bg-slate-800 transition-all duration-100"
          variant={"outline"}
        >
          <Link to="/~" className="w-full">
            Use ModBot <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      ) : (
        <>
          <div>
            <ClientOnly>
              {() => {
                return (
                  <AuthKitProvider config={farcasterConfig}>
                    <Button
                      className="relative w-full min-w-[250px] sm:w-[250px] text-white/80 hover:text-white/100 border-black active:translate-y-[2px] bg-slate-800/80 hover:bg-slate-800 transition-all duration-100"
                      variant={"outline"}
                    >
                      {loggingIn ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        <>
                          <Farcaster className="mr-2 h-5 w-5" />
                          <span>Login with Farcaster</span>
                          <div id="fc-btn-wrap" className="absolute w-full sm:w-[250px]">
                            <SignInButton onSuccess={handleSuccess} />
                          </div>
                        </>
                      )}
                    </Button>
                  </AuthKitProvider>
                );
              }}
            </ClientOnly>
          </div>
        </>
      )}
    </section>
  );
}
