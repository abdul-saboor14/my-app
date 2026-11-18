import {
  ArrowUpRight,
  MapPin,
  Clock3,
} from "lucide-react";

export default function Contact() {
  return (
    <section
      className="contact-section"
      id="contact"
      aria-labelledby="contact-title"
    >
      <div className="container-wide contact-grid">
        <div>
          <p className="eyebrow eyebrow-dark">
            <span className="eyebrow-line" />
            COME AS YOU ARE
          </p>

          <h2
            className="section-heading"
            id="contact-title"
          >
            The table is <em>yours.</em>
          </h2>

          <p>
            Good meals are better shared.
            We look forward to being part of
            your next favorite moment.
          </p>

          <a
            className="text-link"
            href="mailto:hello@example.com"
          >
            Get in touch
            <ArrowUpRight size={18} />
          </a>
        </div>

        <div className="contact-details">
          <div>
            <MapPin size={22} />

            <div>
              <strong>Find us</strong>
              <span>
                Location to be announced
                (placeholder)
              </span>
            </div>
          </div>

          <div>
            <Clock3 size={22} />

            <div>
              <strong>Opening hours</strong>
              <span>
                Hours to be announced
                (placeholder)
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}