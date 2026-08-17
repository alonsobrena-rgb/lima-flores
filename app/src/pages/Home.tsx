import { SiteHeader } from '@/components/SiteHeader';
import { HeroHerbario } from '@/components/sections/HeroHerbario';
import { Marquee } from '@/components/sections/Marquee';
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
      {/* Las categorías van pegadas al cartel: son el primer desvío del
          visitante, y en una tira que se arrastra de lado se ve de qué es cada
          una. Antes acá iba el manifiesto —«Hay emociones que merecen algo más
          que un mensaje»— y era un muro de texto entre la portada y la primera
          foto. Las fotos del catálogo, barajadas, van justo debajo. */}
      <Categories />
      <FeaturedProducts />
      <SignatureProduct />
      <AtelierStory />
      <InstagramGallery />
      <SubscriptionTeaser />
      <SiteFooter />
    </>
  );
}
