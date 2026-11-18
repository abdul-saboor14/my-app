import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import MenuManager from "@/components/MenuManager";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />

      <main id="home">
        <Hero />
        <About />
        <MenuManager />
        <Contact />
      </main>

      <Footer />
    </>
  );
}