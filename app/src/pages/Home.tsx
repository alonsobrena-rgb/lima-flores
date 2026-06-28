import { LimaHero } from '@/components/ui/lima-hero';
import { HomeFloralBg } from '@/components/HomeFloralBg';
import { Marquee } from '@/components/sections/Marquee';
import { Manifesto } from '@/components/sections/Manifesto';
import { SignatureProduct } from '@/components/sections/SignatureProduct';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { Categories } from '@/components/sections/Categories';
import { AtelierStory } from '@/components/sections/AtelierStory';
import { InstagramGallery } from '@/components/sections/InstagramGallery';
import { SubscriptionTeaser } from '@/components/sections/SubscriptionTeaser';
import { SiteFooter } from '@/components/sections/SiteFooter';

const navLinks = [
  { label: 'Inicio', href: '/' },
  { label: 'Catálogo', href: '/catalogo' },
  { label: 'Fúnebre', href: '/funebre' },
  { label: 'Suscripción', href: '/suscripcion' },
  { label: 'Contacto', href: 'https://wa.me/51999479855' },
];

const socials = [
  { label: 'Instagram', href: 'https://instagram.com/lima_flores' },
  { label: 'Facebook', href: 'https://facebook.com/limafloresperu' },
];

export default function Home() {
  return (
    <>
      {/* Fondo fijo para toda la landing (jardín de rosas a contraluz, desenfocado).
          El video va solo en el hero. */}
      <HomeFloralBg src="/bg/landing-jardin.webp" />
      <LimaHero
        navLinks={navLinks}
        socials={socials}
        locationText="Miraflores · Lima"
        videoSrc="/hero/mujer-florero-tulipanes.mp4"
        poster="/hero/mujer-florero-tulipanes-poster.webp"
      />
      {/* Velo ivory translúcido sobre el fondo floral: deja ver las flores pero
          mantiene legible el contenido de las secciones (más blanco = más legible). */}
      <div className="relative bg-ivory-100/[0.78]">
        <Marquee />
        <Manifesto />
        <FeaturedProducts />
        <Categories />
        <SignatureProduct />
        <AtelierStory />
        <InstagramGallery />
        <SubscriptionTeaser />
        <SiteFooter />
      </div>
    </>
  );
}
