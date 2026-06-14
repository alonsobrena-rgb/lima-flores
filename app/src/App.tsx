import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CartProvider } from '@/lib/cart';
import { CartDrawer } from '@/components/CartDrawer';
import { Ambient } from '@/components/motion/Ambient';
import { ScrollProgress } from '@/components/motion/ScrollProgress';
import Home from '@/pages/Home';
import Catalogo from '@/pages/Catalogo';
import Producto from '@/pages/Producto';
import Suscripcion from '@/pages/Suscripcion';
import Checkout from '@/pages/Checkout';
import Confirmacion from '@/pages/Confirmacion';
import Admin from '@/pages/Admin';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      {/* Crossfade entre rutas (sin transform → no rompe sticky/fixed internos) */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/producto/:id" element={<Producto />} />
          <Route path="/suscripcion" element={<Suscripcion />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmacion" element={<Confirmacion />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <CartProvider>
      <ScrollProgress />
      <Ambient />
      <ScrollToTop />
      <div className="relative z-10">
        <AnimatedRoutes />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}

export default App;
