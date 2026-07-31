import {
  FaDiscord,
  FaGithub,
  FaInstagram,
  FaLinkedin,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

// Link legal pages to marketing site.
const SITE = "https://bluelearn.org";

const LEGAL = [
  { label: "Terms", href: `${SITE}/terms` },
  { label: "Privacy", href: `${SITE}/privacy` },
];

const SOCIALS: Array<{ name: string; href: string; Icon: IconType }> = [
  { name: "GitHub", href: "https://github.com/bluelearn-org", Icon: FaGithub },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/blue-learn/",
    Icon: FaLinkedin,
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@blue-learn",
    Icon: FaYoutube,
  },
  { name: "Discord", href: "https://discord.gg/bluesystem", Icon: FaDiscord },
  { name: "X", href: "https://twitter.com/bluelearnorg", Icon: FaXTwitter },
  {
    name: "Instagram",
    href: "https://instagram.com/Bluelearnorg",
    Icon: FaInstagram,
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-8 py-6 lg:px-16">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-light text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Bluelearn</span>
          <nav className="flex items-center gap-6">
            {LEGAL.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          {SOCIALS.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={name}
              aria-label={name}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
