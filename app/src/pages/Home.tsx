import { SiteHeader } from '@/components/SiteHeader';
import { HeroHerbario } from '@/components/sections/HeroHerbario';
import { Marquee } from '@/components/sections/Marquee';
import { Manifesto } from '@/components/sections/Manifesto';
import { SignatureProduct } from '@/components/sections/SignatureProduct';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { Categories } from '@/components/sections/Categories';
import { AtelierStory } from '@/components/sections/AtelierStory';
import { InstagramGallery } from '@/components/sections/InstagramGallery';
import { SubscriptionTeaser } from '@/components/sections/SubscriptionTeaser';
import { SiteFooter } from '@/components/sections/SiteFooter';

/**
 * La portada.
 *
 * El orden es el de siempre; lo que cambia es que ahora todas las secciones
 * salen del mismo molde (`sections/Seccion.tsx`): el mismo margen que el hero,
 * un filete de 1 px entre una y otra, y un único tamaño de título. El `<div>`
 * que envolvía todo para pintar un fondo ya no hace falta — el fondo es blanco
 * y viene del `body`.
 *
 * La tinta aparece una sola vez en el medio (la firma de la casa) y otra al
 * final (el pie): dos respiros oscuros en una página blanca, no seis fondos
 * distintos.
 */
export default function Home() {
  return (
    <>
      {/* La cabecera es la misma en toda la tienda. Antes la portada tenía su
          propia barra dentro del hero, así que el sitio cambiaba de cabecera al
          navegar. */}
      <SiteHeader />
      <HeroHerbario />
      <Marquee />
      <Manifesto />
      <FeaturedProducts />
      <Categories />
      <SignatureProduct />
      <AtelierStory />
      <InstagramGallery />
      <SubscriptionTeaser />
      <SiteFooter />
    </>
  );
}
