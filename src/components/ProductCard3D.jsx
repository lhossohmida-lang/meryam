// =============================================================================
//  WALIDA — ProductCard3D
// -----------------------------------------------------------------------------
//  WebGL-powered product card. Renders a glTF/GLB model in a studio-lit canvas
//  with contact shadows and a gentle auto-rotation. On hover the entire card
//  floats upward and the 3D model scales up subtly — a delightful, premium
//  micro-interaction.
//
//  If a product has no .glb yet (fresh upload, fallback), we render a
//  beautifully stylised proxy (a glowing capsule + label) so the grid still
//  feels luxurious.
// =============================================================================

import React, { Suspense, useRef, useState } from 'react';
import { ErrorBoundary } from '../lib/ErrorBoundary.jsx';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  useGLTF,
  Environment,
  ContactShadows,
  Float,
  PresentationControls,
  Center,
  Bounds
} from '@react-three/drei';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Heart, ShoppingBag, Zap, Images, Box } from 'lucide-react';

import { useCart } from '../App.jsx';

// ---------------------------------------------------------------------------
//  Inner 3D scene
// ---------------------------------------------------------------------------
function GLBModel({ url, hovered }) {
  const ref = useRef();
  const { scene } = useGLTF(url);

  // Gentle auto-rotate; speeds up subtly on hover.
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * (hovered ? 0.6 : 0.25);
  });

  return (
    <Center>
      <primitive ref={ref} object={scene} scale={hovered ? 1.08 : 1} />
    </Center>
  );
}

// Stylised proxy used when a product has no .glb yet — a glowing pastel
// capsule that still feels on-brand.
function ProxyShape({ tint = '#FFB4A2', hovered }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * (hovered ? 0.7 : 0.3);
    ref.current.rotation.x = Math.sin(performance.now() / 1800) * 0.08;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={ref} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshPhysicalMaterial
          color={tint}
          roughness={0.25}
          metalness={0.05}
          clearcoat={0.8}
          clearcoatRoughness={0.2}
          sheen={1}
          sheenColor="#ffffff"
          iridescence={0.6}
          iridescenceIOR={1.3}
        />
      </mesh>
    </Float>
  );
}

function Scene({ modelUrl, tint, hovered }) {
  return (
    <>
      {/* Studio-quality lighting rig */}
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#E7D9FF" />

      {/* Subtle HDRI for premium reflections */}
      <Environment preset="studio" />

      {/* The product — wrapped in an ErrorBoundary so a corrupt / wrong-type
          GLB silently falls back to the iridescent proxy instead of crashing
          the whole storefront. */}
      <Suspense fallback={null}>
        <PresentationControls
          global
          rotation={[0, 0, 0]}
          polar={[-0.15, 0.15]}
          azimuth={[-0.4, 0.4]}
          config={{ mass: 1.2, tension: 220, friction: 22 }}
        >
          <Bounds fit clip observe margin={1.1}>
            <ErrorBoundary fallback={<ProxyShape tint={tint} hovered={hovered} />}>
              {modelUrl ? (
                <GLBModel url={modelUrl} hovered={hovered} />
              ) : (
                <ProxyShape tint={tint} hovered={hovered} />
              )}
            </ErrorBoundary>
          </Bounds>
        </PresentationControls>
      </Suspense>

      {/* The signature soft contact shadow underneath the product */}
      <ContactShadows
        position={[0, -1.05, 0]}
        opacity={0.4}
        scale={6}
        blur={2.6}
        far={2}
        color="#1B1530"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
//  Card wrapper — handles hover float, parallax tilt, and shopping actions.
// ---------------------------------------------------------------------------
// Heuristic: detect legacy "fake GLB" URLs from older simulator runs that
// uploaded JPEG bytes to `/image/upload/` and labelled them .glb. Those will
// never be parseable, so we skip the 3D attempt entirely.
function isLikelyValidModel(url) {
  if (!url) return false;
  if (url.includes('/image/upload/')) return false;   // legacy JPEG-as-GLB
  if (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png')) return false;
  return true;
}

export default function ProductCard3D({ product, index = 0, compact = false }) {
  const { add, toggleFavorite, favorites } = useCart() ?? {};
  const isFav = favorites?.includes(product.id);
  const [hovered, setHovered] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);

  // Compute the best photo to show as fallback or as the primary visual.
  const photoUrl =
    product.imageUrl
    || product.images?.find((i) => i?.url)?.url
    || null;

  // Final decision: render WebGL only if we have a model URL that *looks*
  // valid AND hasn't already errored out at runtime.
  const media3DReady = isLikelyValidModel(product.modelUrl) && !modelFailed;
  const showModel = media3DReady;

  // Subtle parallax tilt based on cursor position.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-50, 50], [6, -6]), { stiffness: 220, damping: 18 });
  const rotY = useSpring(useTransform(mx, [-50, 50], [-6, 6]), { stiffness: 220, damping: 18 });

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left - rect.width / 2);
    my.set(e.clientY - rect.top - rect.height / 2);
  }
  function onLeave() {
    mx.set(0); my.set(0); setHovered(false);
  }

  return (
    <motion.article
      onMouseEnter={() => setHovered(true)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -10 }}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1200 }}
      className="glass-card relative overflow-hidden"
    >
      {/* Top tint glow that intensifies on hover */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{
          background: `radial-gradient(60% 80% at 50% 0%, ${product.tint ?? '#FFD5DC'}55, transparent 70%)`
        }}
        animate={{ opacity: hovered ? 1 : 0.55 }}
        transition={{ duration: 0.4 }}
      />

      {/* Heart / favourite */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleFavorite?.(product.id); }}
        className="absolute top-3 left-3 z-10 grid place-items-center w-9 h-9 rounded-full glass"
        aria-label="favourite"
      >
        <Heart
          size={16}
          className={isFav ? 'fill-coral text-coral' : 'text-ink/60'}
        />
      </button>

      {/* Category chip */}
      {product.category && (
        <span className="chip absolute top-3 right-3 z-10">{product.category}</span>
      )}

      {/* Top-right badges: gallery count + 3D badge.
          The 3D badge hides automatically if the model URL turns out to be
          invalid (legacy product) — `media3DReady` reflects this. */}
      <div className="absolute bottom-[7.2rem] right-3 z-10 flex flex-col gap-1.5 items-end">
        {media3DReady && (
          <span className="chip bg-white/85 text-coral border-white/90 !py-0.5">
            <Box size={11} /> 3D
          </span>
        )}
        {product.images?.length > 1 && (
          <span className="chip bg-white/85 text-ink border-white/90 !py-0.5">
            <Images size={11} /> {product.images.length}
          </span>
        )}
      </div>

      {/* Hero media. Precedence:
          1) Valid .glb model → WebGL canvas (rotates, hovers, premium feel)
          2) Photo (Cloudinary) → smooth-zoom <img>
          3) Nothing yet → iridescent proxy (still on-brand)
          If the .glb fails to load (corrupt / wrong type) we automatically
          fall back to the photo via `setModelFailed(true)`. */}
      <div className={`relative ${compact ? 'h-44' : 'h-56'} w-full overflow-hidden`}>
        {showModel ? (
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [0, 0.4, 3.4], fov: 35 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow />
            <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#E7D9FF" />
            <Environment preset="studio" />
            <Suspense fallback={null}>
              <PresentationControls
                global
                rotation={[0, 0, 0]}
                polar={[-0.15, 0.15]}
                azimuth={[-0.4, 0.4]}
                config={{ mass: 1.2, tension: 220, friction: 22 }}
              >
                <Bounds fit clip observe margin={1.1}>
                  <ErrorBoundary
                    fallback={null}
                    onError={() => setModelFailed(true)}
                  >
                    <GLBModel url={product.modelUrl} hovered={hovered} />
                  </ErrorBoundary>
                </Bounds>
              </PresentationControls>
            </Suspense>
            <ContactShadows
              position={[0, -1.05, 0]} opacity={0.4} scale={6}
              blur={2.6} far={2} color="#1B1530"
            />
          </Canvas>
        ) : photoUrl ? (
          <motion.img
            src={photoUrl}
            alt={product.nameAr}
            loading="lazy"
            initial={{ scale: 1 }}
            animate={{ scale: hovered ? 1.06 : 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [0, 0.4, 3.4], fov: 35 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <Scene modelUrl={null} tint={product.tint} hovered={hovered} />
          </Canvas>
        )}
      </div>

      {/* Meta */}
      <div className="px-4 pb-4 pt-2 text-center">
        <h3 className="text-sm font-semibold text-ink leading-tight">
          {product.nameAr}
        </h3>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink/55 mt-1">
          {product.nameEn}
        </p>
        <p className="mt-2 text-sm font-bold text-coral">
          {product.price} <span className="text-ink/60 text-xs font-medium">دج</span>
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={() => add?.(product)}
            className="btn-pill w-full justify-center"
          >
            <ShoppingBag size={14} />
            أضف للعربة
          </button>
          <button className="btn-coral w-full text-sm py-2.5">
            <Zap size={14} className="opacity-90" />
            شراء الآن
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// Eagerly cache GLB loaders for known models — keeps grid scrolling buttery.
ProductCard3D.preload = (url) => url && useGLTF.preload(url);
