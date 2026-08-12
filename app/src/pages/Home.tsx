import { SiteHeader } from '@/components/SiteHeader';
import { HeroVitrina } from '@/components/sections/HeroVitrina';
import { Marquee } from '@/components/sections/Marquee';
import { Manifesto } from '@/components/sections/Manifesto';
import { SignatureProduct } from '@/components/sections/SignatureProduct';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { Categories } from '@/components/sections/Categories';
import { AtelierStory } from '@/components/sections/AtelierStory';
import { InstagramGallery } from '@/components/sections/InstagramGallery';
import { SubscriptionTeaser } from '@/components/sections/SubscriptionTeaser';
import { SiteFooter } from '@/components/sections/SiteFooter';

export default function Home() {
  return (
    <>
      {/* La cabecera es la misma en toda la tienda. Antes la portada tenía su
          propia barra dentro del hero, así que el sitio cambiaba de cabecera al
          navegar. */}
      <SiteHeader />
      <HeroVitrina />
      {/* El sistema Florencia es blanco y aire: el fondo floral generado y las
          manchas de acuarela que había detrás de todo ensuciaban el blanco y
          peleaban con las fotos de producto, que son lo que tiene que mandar. */}
      <div className="relative bg-background">
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
