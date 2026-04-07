import { Nav } from "@/components/public/nav";
import { Footer } from "@/components/public/footer";
import { ConditionalFooter } from "@/components/public/conditional-footer";
import { getSettings, parseSocialLinks } from "@/lib/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const socialLinks = parseSocialLinks(settings?.socialLinks);

  return (
    <>
      <Nav />
      {children}
      <ConditionalFooter>
        <Footer socialLinks={socialLinks} />
      </ConditionalFooter>
    </>
  );
}
