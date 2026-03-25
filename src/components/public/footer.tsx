interface SocialLink {
  platform: string;
  url: string;
}

interface FooterProps {
  socialLinks: SocialLink[];
}

export function Footer({ socialLinks }: FooterProps) {
  return (
    <footer className="py-12 px-6 text-center border-t border-gray-100">
      {socialLinks.length > 0 && (
        <div className="flex justify-center gap-6 mb-4">
          {socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 tracking-wider hover:text-gray-600 transition-colors"
            >
              {link.platform.toUpperCase()}
            </a>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-300">
        &copy; {new Date().getFullYear()} Mindy Hu Photography
      </p>
    </footer>
  );
}
