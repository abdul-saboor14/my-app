import { ArrowUpRight } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container-wide footer-grid">
        <div className="footer-brand">
          <a
            className="wordmark"
            href="#home"
          >
            Savoria
            <span className="wordmark-dot">
              .
            </span>
          </a>

          <p>
            Thoughtful flavors. Meaningful moments.
            <br />
            The art of dining, every day.
          </p>
        </div>

        <div>
          <h3>Explore</h3>

          <a href="#home">Home</a>
          <a href="#menu">Our Menu</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>

        <div>
          <h3>Say hello</h3>

          <p>Demo contact details only</p>

          <a href="mailto:hello@example.com">
            hello@example.com
            <ArrowUpRight size={14} />
          </a>

          <p>Location: not yet provided</p>
        </div>
      </div>

      <div className="container-wide footer-bottom">
        <span>
          © {new Date().getFullYear()} Savoria.
          All rights reserved.
        </span>

        <span>
          Made for the love of good food.
        </span>
      </div>
    </footer>
  );
}