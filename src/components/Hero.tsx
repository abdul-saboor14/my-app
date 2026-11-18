"use client";

import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

export default function Hero() {
  return (
    <section
      className="hero"
      aria-labelledby="hero-title"
    >
      <div
        className="hero-image"
        role="img"
        aria-label="Beautifully plated restaurant food"
      />

      <div className="hero-shade" />

      <div className="container-wide hero-content">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
        >
          <p className="eyebrow hero-eyebrow">
            <span className="eyebrow-line" />
            WELCOME TO SAVORIA
          </p>

          <h1 id="hero-title">
            Every Dish
            <br />
            <em>Tells a Story.</em>
          </h1>

          <p className="hero-description">
            Discover thoughtfully prepared flavors,
            fresh ingredients, and moments worth
            savoring.
          </p>

          <div className="hero-actions">
            <a
              href="#menu"
              className="button button-primary"
            >
              Explore Our Menu
              <ArrowUpRight size={18} />
            </a>

            <a
              href="#about"
              className="button button-ghost"
            >
              Our Story
              <ArrowDownRight size={18} />
            </a>
          </div>
        </motion.div>
      </div>

      <div className="hero-bottom container-wide">
        <span>GOOD FOOD. BEAUTIFUL MOMENTS.</span>

        <a
          href="#about"
          aria-label="Scroll to our story"
        >
          <ArrowDownRight size={20} />
        </a>

        <span>EST. WITH PASSION</span>
      </div>
    </section>
  );
}