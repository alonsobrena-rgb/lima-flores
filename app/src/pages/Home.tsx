import { SiteHeader } from '@/components/SiteHeader';
import { HeroHerbario } from '@/components/sections/HeroHerbario';
import { Marquee } from '@/components/sections/Marquee';
import { SignatureProduct } from '@/components/sections/SignatureProduct';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { Categories } from '@/components/sections/Categories';
import { ProductStrip } from '@/components/sections/ProductStrip';
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
      {/* Pegado al cartel va producto, no texto: una tira de ocho al azar que se
          arrastra de lado, con la ficha casi del tamaño de la pantalla. Acá
          estaba el manifiesto —«Hay emociones que merecen algo más que un
          mensaje»— y era un muro entre la portada y la primera foto.
          Después las categorías, en su grilla de siempre, y la colección
          completa: los tres bloques salen del mismo barajado, así que ningún
          ramo se repite en la misma pantalla. */}
      <ProductStrip />
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
