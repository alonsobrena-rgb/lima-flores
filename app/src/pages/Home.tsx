import { LimaHero } from '@/components/ui/lima-hero';
import { Marquee } from '@/components/sections/Marquee';
import { Manifesto } from '@/components/sections/Manifesto';
import { SignatureProduct } from '@/components/sections/SignatureProduct';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { Categories } from '@/components/sections/Categories';
import { AtelierStory } from '@/components/sections/AtelierStory';
import { Testimonials } from '@/components/sections/Testimonials';
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
      <LimaHero
        videoSrc="/hero/mujer-recibe-flores.mp4"
        poster="/hero/mujer-recibe-flores-poster.webp"
        imageAlt="Una mujer recibiendo un ramo de flores de Lima Flores"
        navLinks={navLinks}
        socials={socials}
        locationText="Miraflores · Lima"
      />
      <Marquee />
      <Manifesto />
      <FeaturedProducts />
      <Categories />
      <SignatureProduct />
      <AtelierStory />
      <Testimonials />
      <SubscriptionTeaser />
      <SiteFooter />
    </>
  );
}
