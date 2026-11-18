"use client";

import { motion } from "motion/react";
import {
  ArrowUpRight,
  Leaf,
  UtensilsCrossed,
} from "lucide-react";

export default function About() {
  return (
    <section
      className="section about-section"
      id="about"
      aria-labelledby="about-title"
    >
      <div className="container-wide about-grid">
        <motion.div
          className="about-art"
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
        >
          <div
            className="about-photo"
            role="img"
            aria-label="Seasonal gourmet dining experience"
          />

          <div className="about-photo-accent">
            <span>MADE TO</span>
            <strong>be savored</strong>
          </div>

          <span className="about-photo-corner">
            01 / OUR STORY
          </span>
        </motion.div>

        <motion.div
          className="about-copy"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{
            duration: 0.7,
            delay: 0.1,
          }}
        >
          <p className="eyebrow eyebrow-dark">
            <span className="eyebrow-line" />
            A LITTLE ABOUT US
          </p>

          <h2
            className="section-heading"
            id="about-title"
          >
            Where good food
            <br />
            meets <em>good company.</em>
          </h2>

          <div className="gold-line" />

          <p className="body-lead">
            At Savoria, we believe the best moments
            happen around a table.
          </p>

          <p className="body-muted">
            Our kitchen celebrates simple ingredients,
            thoughtful preparation, and the joy of
            sharing something delicious. Every plate
            is an invitation to slow down, connect,
            and savor a little more.
          </p>

          <div className="about-values">
            <div>
              <span className="value-icon">
                <Leaf size={21} />
              </span>

              <span>
                <strong>Fresh by nature</strong>
                <small>
                  Ingredients that speak for themselves
                </small>
              </span>
            </div>

            <div>
              <span className="value-icon">
                <UtensilsCrossed size={21} />
              </span>

              <span>
                <strong>Crafted with care</strong>
                <small>
                  A little thought in every detail
                </small>
              </span>
            </div>
          </div>

          <a href="#menu" className="text-link">
            Discover our menu
            <ArrowUpRight size={18} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}