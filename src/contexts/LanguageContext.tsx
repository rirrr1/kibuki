import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type Language = 'en' | 'de';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('de')) {
    return 'de';
  }
  return 'en';
};

const detectLanguageFromPath = (pathname: string): Language | null => {
  if (pathname.startsWith('/en')) {
    return 'en';
  }
  if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/success') || pathname.startsWith('/physical-success')) {
    return 'de';
  }
  return null;
};

const detectLanguageFromQuery = (): Language | null => {
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang');
  if (langParam === 'en' || langParam === 'de') {
    return langParam;
  }
  return null;
};

const translationsEn: Record<string, string> = {
  'landing.previewBanner': '🔍 Preview Mode: Stripe checkout is disabled. You can test the full comic generation flow without payment.',
  'landing.menu.createComic': 'Create Comic',
  'landing.menu.howItWorks': 'How It Works',
  'landing.menu.examples': 'Examples',
  'landing.menu.pricing': 'Pricing',
  'landing.menu.faq': 'Q&A',
  'landing.noSignup': '💳 No credit card required',
  'landing.testFree': '✨ Start for free',
  'landing.hero.h1': 'Create Your Own Personalized Comic Book',
  'landing.hero.subtitle': 'Transform yourself into a superhero and create personalized comic books as digital downloads or premium physical copies',
  'landing.hero.cta': 'Create Your Comic',
  'landing.hero.ebook': 'E-Book',
  'landing.hero.printed': 'Printed',
  'landing.howItWorks.title': 'How It Works',
  'landing.howItWorks.subtitle': 'Three simple steps to your personalized comic book',
  'landing.howItWorks.step1.title': 'Customize',
  'landing.howItWorks.step1.desc': 'Upload your photo, choose your style, and describe your story',
  'landing.howItWorks.step2.title': 'AI Generation',
  'landing.howItWorks.step2.desc': 'Our AI creates your comic in minutes. Preview and edit pages if needed',
  'landing.howItWorks.step3.title': 'Receive',
  'landing.howItWorks.step3.desc': 'Download your e-book instantly or order a premium printed version',
  'landing.giftIdeas.title': 'Perfect Comic Book Gifts for Every Occasion',
  'landing.giftIdeas.subtitle': 'Personalized comics make unforgettable gifts for birthdays, anniversaries, and special celebrations',
  'landing.giftIdeas.birthday.title': 'Birthday Gift',
  'landing.giftIdeas.birthday.desc': 'Create a unique personalized comic book birthday gift that celebrates their special day with a custom superhero adventure',
  'landing.giftIdeas.christmas.title': 'Christmas Gift',
  'landing.giftIdeas.christmas.desc': 'Make this Christmas unforgettable with a personalized comic book that brings holiday magic and superhero adventures together',
  'landing.giftIdeas.special.title': 'Special Occasions',
  'landing.giftIdeas.special.desc': 'Perfect for anniversaries, graduations, retirement, or any milestone worth celebrating with a custom story',
  'landing.giftIdeas.wedding.title': 'Wedding Gift',
  'landing.giftIdeas.wedding.desc': 'Celebrate love with a personalized comic book that tells their unique love story as an epic romantic adventure',
  'landing.benefits.title': 'Why Choose Personalized Comics',
  'landing.benefits.subtitle': 'Create unforgettable memories with custom comic books that tell your unique story',
  'landing.benefits.gift.title': 'Perfect Gift',
  'landing.benefits.gift.desc': 'Surprise your loved ones with a truly unique and memorable gift that celebrates their story and personality',
  'landing.benefits.hero.title': 'Personalized Hero',
  'landing.benefits.hero.desc': 'Transform yourself or anyone into a comic book superhero with custom characters, powers, and adventures',
  'landing.benefits.story.title': 'Your Own Story',
  'landing.benefits.story.desc': 'Tell your unique story or create an entirely new adventure tailored to your imagination and preferences',
  'landing.benefits.quality.title': 'Premium Quality',
  'landing.benefits.quality.desc': 'Choose between instant digital downloads or beautifully printed physical copies shipped to your door',
  'landing.examples.title': 'See Our Personalized Comic Books',
  'landing.examples.subtitle': 'Transform from an everyday photo into an extraordinary comic book hero',
  'landing.examples.classic.title': 'Classic Hero Style',
  'landing.examples.classic.desc': 'Traditional comic book aesthetics with bold colors and dynamic action',
  'landing.examples.sports.title': 'Sports Champion',
  'landing.examples.sports.desc': 'Celebrate your favorite sport with custom superhero adventures',
  'landing.examples.superdad.title': 'Superdad Edition',
  'landing.examples.superdad.desc': 'Honor the real-life heroes with personalized family stories',
  'landing.examples.cta.title': 'Start Your Journey Today',
  'landing.examples.cta.subtitle': 'Upload your photo and let our AI transform you into a comic book hero',
  'landing.examples.cta.button': 'Create Your Comic Now',
  'landing.exampleComics.title': 'Comic Examples',
  'landing.exampleComics.subtitle': 'See what you can create with our AI comic generator. Here are some example prompts and their results:',
  'landing.exampleComics.prompt': 'Example Prompt:',
  'landing.exampleComics.download': 'Download Example PDF',
  'landing.exampleComics.mike.prompt': 'Mike discovers a mysterious portal in his basement that transports him to a superhero academy. There he learns he has special powers and must save the city from an evil villain who controls technology. After an epic battle, Mike returns home as a true hero.',
  'landing.exampleComics.mike.title': 'Mike\'s Adventure',
  'landing.pricing.title': 'Credit Packages',
  'landing.pricing.subtitle': 'Simple, transparent pricing - Buy credits and create your comics',
  'landing.pricing.starter.title': 'Starter Pack',
  'landing.pricing.starter.price': 'CHF 9.99',
  'landing.pricing.starter.credits': '20 Credits',
  'landing.pricing.starter.feature1': '1 comic generation (20 credits)',
  'landing.pricing.starter.feature2': 'Preview & edit pages (5 credits each)',
  'landing.pricing.starter.feature3': 'High-quality PDF download',
  'landing.pricing.starter.feature4': 'Order physical print separately',
  'landing.pricing.popular.title': 'Popular Pack',
  'landing.pricing.popular.price': 'CHF 19.90',
  'landing.pricing.popular.credits': '40 Credits',
  'landing.pricing.popular.feature1': '2 comics or 1 + multiple edits',
  'landing.pricing.popular.feature2': 'Best value for money',
  'landing.pricing.popular.feature3': 'All features included',
  'landing.pricing.popular.feature4': 'Credits never expire',
  'landing.pricing.best.title': 'Best Value',
  'landing.pricing.best.price': 'CHF 29.90',
  'landing.pricing.best.credits': '100 Credits',
  'landing.pricing.best.feature1': '5 comics with edits',
  'landing.pricing.best.feature2': 'Maximum flexibility',
  'landing.pricing.best.feature3': 'Perfect for multiple gifts',
  'landing.pricing.best.feature4': 'Best price per credit',
  'landing.pricing.physical.title': 'Physical Print',
  'landing.pricing.physical.price': '€39.00',
  'landing.pricing.physical.subtitle': 'Add a premium printed copy',
  'landing.pricing.physical.feature1': 'Premium printing quality',
  'landing.pricing.physical.feature2': 'Free shipping (DE, CH, AUT)',
  'landing.pricing.physical.feature3': 'Delivered in 7-14 days',
  'landing.pricing.physical.feature4': 'Beautiful physical keepsake',
  'landing.faq.title': 'Frequently Asked Questions',
  'landing.faq.q1': 'How long does it take to create my comic book?',
  'landing.faq.a1': 'Digital comics are generated instantly after payment. Physical comics are printed and shipped within 7-14 business days.',
  'landing.faq.q2': 'Can I preview and edit my comic before finalizing?',
  'landing.faq.a2': 'Yes! After generation, you\'ll receive a preview of all pages. You can request one edit per page if needed before finalizing your comic.',
  'landing.faq.q3': 'Can I change the comic after finalization?',
  'landing.faq.a3': 'Unfortunately you can\'t change the comic after it has been finalized and the PDF is created, as we use artificial intelligence to create each individual comic.',
  'landing.faq.q4': 'How much does a comic cost?',
  'landing.faq.a4': 'The downloadable PDF version of the comic costs 8.90 EUR and a physical print version 39 EUR.',
  'landing.faq.q5': 'How detailed I have to describe the story?',
  'landing.faq.a5': 'A brief description is enough, we recommend to use clear and easy to understand sentences and highlight anything important for your story.',
  'landing.faq.q6': 'Do you offer refunds?',
  'landing.faq.a6': 'No. Generated comics can not be refunded.',
  'landing.faq.q7': 'How many pages will my comic book have?',
  'landing.faq.a7': 'Your comic book will have a total of 12 pages: 10 content pages plus a front cover and back cover.',
  'landing.footer.description': 'Create personalized comic books that bring your stories to life. Transform anyone into a superhero with our AI-powered comic creation platform.',
  'landing.footer.quickLinks': 'Quick Links',
  'landing.footer.howItWorks': 'How It Works',
  'landing.footer.examples': 'Examples',
  'landing.footer.pricing': 'Pricing',
  'landing.footer.support': 'Support',
  'landing.footer.legal': 'Legal',
  'landing.footer.privacy': 'Privacy Policy',
  'landing.footer.terms': 'Terms of Service',
  'landing.footer.refund': 'Refund Policy',
  'landing.footer.contact': 'Contact Us',
  'landing.footer.copyright': '© 2025 MyComic-Book.com. All rights reserved. Powered by AI and imagination.',

  'config.backToHome': 'Back to Home',
  'config.sectionsCompleted': 'sections completed',
  'config.progress': 'Progress',
  'config.step.basic': 'Basic Info',
  'config.step.basic.desc': 'Hero name & comic title',
  'config.step.photo': 'Photo',
  'config.step.photo.desc': 'Upload hero photo',
  'config.step.character': 'Character',
  'config.step.character.desc': 'Choose character style',
  'config.step.story': 'Story',
  'config.step.story.desc': 'Describe your adventure',
  'config.step.illustration': 'Art Style',
  'config.step.illustration.desc': 'Pick illustration style',
  'config.step.review': 'Review',
  'config.step.review.desc': 'Final review',
  'config.step.checkout': 'Checkout',
  'config.step.checkout.desc': 'Payment & generate',
  'config.basic.title': 'Basic Information',
  'config.basic.subtitle': 'Let\'s start with your hero\'s name and comic title',
  'config.basic.heroName': 'Hero Name',
  'config.basic.heroName.placeholder': 'Enter hero name...',
  'config.basic.comicTitle': 'Comic Book Title',
  'config.basic.comicTitle.placeholder': 'Enter comic book title...',
  'config.photo.title': 'Hero Photo',
  'config.photo.subtitle': 'Upload a clear photo of your hero',
  'config.photo.uploaded': '✓ Photo uploaded successfully!',
  'config.photo.replace': 'Replace photo',
  'config.photo.hint': '💡 Make sure the hero\'s face is clearly visible on the photo',
  'config.photo.upload': 'Click to upload photo',
  'config.photo.formats': 'PNG, JPG up to 10MB',
  'config.character.title': 'Character Style',
  'config.character.subtitle': 'What type of character is your hero?',
  'config.character.superhero': 'Superhero',
  'config.character.superhero.desc': 'Classic cape-wearing hero with superpowers',
  'config.character.adventurer': 'Adventurer',
  'config.character.adventurer.desc': 'Explorer ready for any quest or journey',
  'config.character.princess': 'Princess',
  'config.character.princess.desc': 'Royal character with elegance and grace',
  'config.character.fighter': 'Fighter',
  'config.character.fighter.desc': 'Warrior skilled in combat and strategy',
  'config.character.magician': 'Magician',
  'config.character.magician.desc': 'Mystical spellcaster with magical powers',
  'config.character.custom': 'Custom',
  'config.character.custom.desc': 'Create your own unique character type',
  'config.character.customLabel': 'Custom Character Style',
  'config.character.customPlaceholder': 'Describe your custom character style...',
  'config.story.title': 'Your Story',
  'config.story.subtitle': 'Describe the adventure your hero will experience',
  'config.story.label': 'Story Description',
  'config.story.placeholder': 'Describe your comic book story...',
  'config.story.language': 'Language',
  'config.story.language.english': 'English',
  'config.story.language.german': 'German',
  'config.story.exampleTitle': '💡 Example for inspiration:',
  'config.illustration.title': 'Illustration Style',
  'config.illustration.subtitle': 'Choose the art style for your comic',
  'config.illustration.superhero': 'Superhero Comic',
  'config.illustration.superhero.desc': 'Classic Superhero look - instantly captivating, popular with adults & kids',
  'config.illustration.cartoon': 'Cartoon Style',
  'config.illustration.cartoon.desc': 'Friendly, colorful, perfect for family gifts',
  'config.illustration.manga': 'Japanese Manga/Anime Style',
  'config.illustration.manga.desc': 'Dynamic anime-inspired art with expressive characters',
  'config.review.title': 'Review & Generate',
  'config.review.subtitle': 'Review your comic details and generate your personalized comic book',
  'config.review.basicInfo': 'Basic Information',
  'config.review.hero': 'Hero',
  'config.review.title.label': 'Title',
  'config.review.notSet': 'Not set',
  'config.review.heroPhoto': 'Hero Photo',
  'config.review.noPhoto': 'No photo uploaded',
  'config.review.characterStyle': 'Character Style',
  'config.review.notSelected': 'Not selected',
  'config.review.customNotDefined': 'Custom style not defined',
  'config.review.story': 'Story',
  'config.review.noStory': 'No story description provided',
  'config.review.artStyle': 'Art Style',
  'config.review.generate': 'Generate',
  'config.review.completeAll': 'Please complete all sections to continue',
  'config.checkout.title': 'Checkout',
  'config.checkout.subtitle': 'Enter your details to purchase and generate your comic',
  'config.checkout.personalInfo': 'Personal Information',
  'config.checkout.firstName': 'First Name',
  'config.checkout.lastName': 'Last Name',
  'config.checkout.email': 'Email',
  'config.checkout.acceptTerms': 'I accept the',
  'config.checkout.termsLink': 'Terms and Conditions',
  'config.checkout.aiDisclaimer': '⚠️ AI Content Disclaimer',
  'config.checkout.aiDisclaimerText': 'I understand that this is an AI-generated comic book and may contain imperfections, errors, or unexpected results. There is no guarantee of perfection.',
  'config.checkout.aiDisclaimerDe': '(Ich verstehe, dass dies ein KI-generiertes Comic ist und Fehler enthalten kann. Es gibt keine Perfektion-Garantie.)',
  'config.checkout.orderSummary': 'Order Summary',
  'config.checkout.digitalComic': 'Digital Comic Book',
  'config.checkout.total': 'Total',
  'config.checkout.button': 'Purchase & Generate Comic - €5.90',
  'config.checkout.processing': 'Processing...',
  'config.checkout.fillAll': 'Please fill in all fields and accept both checkboxes',
  'config.checkout.securePayment': 'Secure payment via Stripe',
  'config.navigation.previous': 'Previous',
  'config.navigation.next': 'Next',
  'config.navigation.backToReview': 'Back to Review',
};

const translationsDe: Record<string, string> = {
  'landing.previewBanner': '🔍 Vorschau-Modus: Stripe-Checkout ist deaktiviert. Sie können den vollständigen Comic-Generierungsprozess ohne Zahlung testen.',
  'landing.menu.createComic': 'Comic Erstellen',
  'landing.menu.howItWorks': 'So Funktioniert Es',
  'landing.menu.examples': 'Beispiele',
  'landing.menu.pricing': 'Preise',
  'landing.menu.faq': 'Q&A',
  'landing.noSignup': '💳 Keine Kreditkarte notwendig',
  'landing.testFree': '✨ Start for free',
  'landing.hero.h1': 'Erstelle Dein Personalisiertes Comic',
  'landing.hero.subtitle': 'Verwandle dich in einen Superhelden und erstelle personalisierte Comic-Bücher als digitale Downloads oder hochwertige gedruckte Exemplare',
  'landing.hero.cta': 'Comic Erstellen',
  'landing.hero.ebook': 'E-Book',
  'landing.hero.printed': 'Gedruckt',
  'landing.howItWorks.title': 'So Funktioniert Es',
  'landing.howItWorks.subtitle': 'Drei einfache Schritte zu deinem personalisierten Comic-Buch',
  'landing.howItWorks.step1.title': 'Personalisieren',
  'landing.howItWorks.step1.desc': 'Lade ein Foto des Helden hoch, wähle deinen Stil und beschreibe deine Geschichte',
  'landing.howItWorks.step2.title': 'Generierung',
  'landing.howItWorks.step2.desc': 'Unsere KI erstellt dein Comic. Du erhälst eine Vorschau wo du Seiten neu erstellen lassen kannst',
  'landing.howItWorks.step3.title': 'Fertiges Comic',
  'landing.howItWorks.step3.desc': 'Lade dein E-Book sofort herunter oder bestelle eine hochwertige gedruckte Version',
  'landing.giftIdeas.title': 'Perfekte Comic Geschenke für Jeden Anlass',
  'landing.giftIdeas.subtitle': 'Personalisierte Comics sind unvergessliche Geschenke für Geburtstage, Jubiläen und besondere Feiern',
  'landing.giftIdeas.birthday.title': 'Geburtstagsgeschenk',
  'landing.giftIdeas.birthday.desc': 'Erstelle ein einzigartiges personalisiertes Comic als Geburtstagsgeschenk mit einem individuellen Superhelden-Abenteuer',
  'landing.giftIdeas.christmas.title': 'Weihnachtsgeschenk',
  'landing.giftIdeas.christmas.desc': 'Mache dieses Weihnachten unvergesslich mit einem personalisierten Comic, das Weihnachtszauber und Superhelden-Abenteuer vereint',
  'landing.giftIdeas.special.title': 'Besondere Anlässe',
  'landing.giftIdeas.special.desc': 'Perfekt für Jubiläen, Abschlüsse, Ruhestand oder jeden Meilenstein, der mit einer individuellen Geschichte gefeiert werden sollte',
  'landing.giftIdeas.wedding.title': 'Hochzeitsgeschenk',
  'landing.giftIdeas.wedding.desc': 'Feiere die Liebe mit einem personalisierten Comic, das ihre einzigartige Liebesgeschichte als episches romantisches Abenteuer erzählt',
  'landing.benefits.title': 'Warum Personalisierte Comics',
  'landing.benefits.subtitle': 'Schaffe unvergessliche Erinnerungen mit individuellen Comic-Büchern, die deine einzigartige Geschichte erzählen',
  'landing.benefits.gift.title': 'Perfektes Geschenk',
  'landing.benefits.gift.desc': 'Überrasche deine Liebsten mit einem wirklich einzigartigen und unvergesslichen Geschenk, das ihre Geschichte und Persönlichkeit feiert',
  'landing.benefits.hero.title': 'Personalisierter Held',
  'landing.benefits.hero.desc': 'Verwandle dich oder andere in einen Comic-Superhelden mit individuellen Charakteren, Kräften und Abenteuern',
  'landing.benefits.story.title': 'Deine Eigene Geschichte',
  'landing.benefits.story.desc': 'Erzähle deine einzigartige Geschichte oder erschaffe ein völlig neues Abenteuer nach deiner Fantasie',
  'landing.benefits.quality.title': 'Premium-Qualität',
  'landing.benefits.quality.desc': 'Wähle zwischen sofortigen digitalen Downloads oder wunderschön gedruckten physischen Exemplaren, die zu dir nach Hause geliefert werden',
  'landing.examples.title': 'Verwandle Dich in einen Superhelden und erzähle Deine Geschichte',
  'landing.examples.subtitle': 'Verwandle ein alltägliches Foto in einen außergewöhnlichen Comic-Helden',
  'landing.examples.classic.title': 'Klassischer Helden-Stil',
  'landing.examples.classic.desc': 'Traditionelle Comic-Ästhetik mit kräftigen Farben und dynamischer Action',
  'landing.examples.sports.title': 'Sport-Champion',
  'landing.examples.sports.desc': 'Feiere deinen Lieblingssport mit individuellen Superhelden-Abenteuern',
  'landing.examples.superdad.title': 'Superpapa-Edition',
  'landing.examples.superdad.desc': 'Ehre die echten Helden mit personalisierten Familiengeschichten',
  'landing.examples.cta.title': 'Starte Deine Reise Heute',
  'landing.examples.cta.subtitle': 'Lade dein Foto hoch und lass unsere KI dich in einen Comic-Helden verwandeln',
  'landing.examples.cta.button': 'Jetzt Comic Erstellen',
  'landing.exampleComics.title': 'Comic Beispiele',
  'landing.exampleComics.subtitle': 'Sieh, was du mit unserem KI-Comic-Generator erstellen kannst. Hier sind einige Beispiel-Prompts und ihre Ergebnisse:',
  'landing.exampleComics.prompt': 'Beispiel-Prompt:',
  'landing.exampleComics.download': 'Beispiel Herunterladen',
  'landing.exampleComics.mike.prompt': 'Mike entdeckt ein mysteriöses Portal in seinem Keller, das ihn zu einer Superhelden-Akademie transportiert. Dort erfährt er, dass er besondere Kräfte hat und die Stadt vor einem bösen Schurken retten muss, der Technologie kontrolliert. Nach einem epischen Kampf kehrt Mike als wahrer Held nach Hause zurück.',
  'landing.exampleComics.mike.title': 'Mike\'s Abenteuer',
  'landing.pricing.title': 'Credit-Pakete',
  'landing.pricing.subtitle': 'Einfache, transparente Preise - Kaufe Credits und erstelle deine Comics',
  'landing.pricing.starter.title': 'Starter-Paket',
  'landing.pricing.starter.price': 'CHF 9.99',
  'landing.pricing.starter.credits': '20 Credits',
  'landing.pricing.starter.feature1': '1 Comic-Generierung (20 Credits)',
  'landing.pricing.starter.feature2': 'Vorschau & Seiten bearbeiten (5 Credits pro Seite)',
  'landing.pricing.starter.feature3': 'Hochwertiger PDF-Download',
  'landing.pricing.starter.feature4': 'Physischer Druck separat bestellbar',
  'landing.pricing.popular.title': 'Beliebtes Paket',
  'landing.pricing.popular.price': 'CHF 19.90',
  'landing.pricing.popular.credits': '40 Credits',
  'landing.pricing.popular.feature1': '2 Comics oder 1 + mehrere Bearbeitungen',
  'landing.pricing.popular.feature2': 'Bestes Preis-Leistungs-Verhältnis',
  'landing.pricing.popular.feature3': 'Alle Funktionen enthalten',
  'landing.pricing.popular.feature4': 'Credits verfallen nie',
  'landing.pricing.best.title': 'Bester Wert',
  'landing.pricing.best.price': 'CHF 29.90',
  'landing.pricing.best.credits': '100 Credits',
  'landing.pricing.best.feature1': '5 Comics mit Bearbeitungen',
  'landing.pricing.best.feature2': 'Maximale Flexibilität',
  'landing.pricing.best.feature3': 'Perfekt für mehrere Geschenke',
  'landing.pricing.best.feature4': 'Bester Preis pro Credit',
  'landing.pricing.physical.title': 'Physischer Druck',
  'landing.pricing.physical.price': '39,00 €',
  'landing.pricing.physical.subtitle': 'Füge eine hochwertige gedruckte Ausgabe hinzu',
  'landing.pricing.physical.feature1': 'Premium Druckqualität',
  'landing.pricing.physical.feature2': 'Versandkostenfrei (DE, CH, AUT)',
  'landing.pricing.physical.feature3': 'Lieferung in 7-14 Tagen',
  'landing.pricing.physical.feature4': 'Wunderschönes Geschenk',
  'landing.faq.title': 'Häufig Gestellte Fragen',
  'landing.faq.q1': 'Wie lange dauert es, mein Comic-Buch zu erstellen?',
  'landing.faq.a1': 'Die Generierung des Comics dauert in der Regel 3-4 Minuten. Dein Comic ist direkt nach Generierung bereit zum Download. Physische Bestellungen werden innerhalb von 7-14 Werktagen gedruckt und versendet.',
  'landing.faq.q2': 'Kann ich mein Comic vor der Fertigstellung ansehen und bearbeiten?',
  'landing.faq.a2': 'Ja, nach der Generierung erhältst du eine Vorschau aller Seiten. Du kannst für jede Seite gegen Credits neu generiern, bevor du dein Comic fertigstellst.',
  'landing.faq.q3': 'Kann ich das Comic nach der Fertigstellung ändern?',
  'landing.faq.a3': 'Nein, das fertige Comic kann nicht mehr geändert werden, da jedes Comic einmalig erstellt und generiert wird .',
  'landing.faq.q4': 'Wie viel kostet ein Comic?',
  'landing.faq.a4': 'Die Generierung eines Comic Ebooks kostet 100 Credits, Die Re-generierung einer Seite 10 Credits, Und eine gedruckte Version inkl. Versand 39 EUR.',
  'landing.faq.q5': 'Wie detailliert muss ich die Geschichte beschreiben?',
  'landing.faq.a5': 'Eine kurze Beschreibung reicht aus. Wir empfehlen, klare und leicht verständliche Sätze zu verwenden. Baue deine Geschichte logisch auf (Anfang, Ende, Schluss) und hebe Wichtige für deine Geschichte besonders hervor.',
  'landing.faq.q6': 'Bietet ihr Rückerstattungen an, wenn ich mit meinem Comic nicht zufrieden bin?',
  'landing.faq.a6': 'Nein. Generierte Comics können nicht zurückerstattet werden.',
  'landing.faq.q7': 'Wie viele Seiten hat mein Comic-Buch?',
  'landing.faq.a7': 'Dein Comic-Buch hat insgesamt 12 Seiten: 10 Inhaltsseiten plus ein Vordercover und ein Rückcover.',
  'landing.footer.description': 'Erstelle personalisierte Comic-Bücher, die deine Geschichten zum Leben erwecken. Verwandle jeden in einen Superhelden mit unserer KI-gestützten Comic-Erstellungsplattform.',
  'landing.footer.quickLinks': 'Schnelllinks',
  'landing.footer.howItWorks': 'So Funktioniert Es',
  'landing.footer.examples': 'Beispiele',
  'landing.footer.pricing': 'Preise',
  'landing.footer.support': 'Support',
  'landing.footer.legal': 'Rechtliches',
  'landing.footer.privacy': 'Datenschutz',
  'landing.footer.terms': 'AGB',
  'landing.footer.refund': 'Rückerstattung',
  'landing.footer.contact': 'Kontakt',
  'landing.footer.copyright': '© 2025 MyComic-Book.com. Alle Rechte vorbehalten. Angetrieben von KI und Fantasie.',

  'config.backToHome': 'Zurück zur Startseite',
  'config.sectionsCompleted': 'Abschnitte abgeschlossen',
  'config.progress': 'Fortschritt',
  'config.step.basic': 'Grundinfo',
  'config.step.basic.desc': 'Heldenname & Comic-Titel',
  'config.step.photo': 'Foto',
  'config.step.photo.desc': 'Heldenfoto hochladen',
  'config.step.character': 'Charakter',
  'config.step.character.desc': 'Charakterstil wählen',
  'config.step.story': 'Geschichte',
  'config.step.story.desc': 'Abenteuer beschreiben',
  'config.step.illustration': 'Kunststil',
  'config.step.illustration.desc': 'Illustrationsstil wählen',
  'config.step.review': 'Überprüfung',
  'config.step.review.desc': 'Letzte Überprüfung',
  'config.step.checkout': 'Kasse',
  'config.step.checkout.desc': 'Zahlung & Generierung',
  'config.basic.title': 'Grundinformationen',
  'config.basic.subtitle': 'Beginnen wir mit dem Namen deines Helden und dem Comic-Titel',
  'config.basic.heroName': 'Heldenname',
  'config.basic.heroName.placeholder': 'Heldenname eingeben...',
  'config.basic.comicTitle': 'Comic-Buchtitel',
  'config.basic.comicTitle.placeholder': 'Comic-Titel eingeben...',
  'config.photo.title': 'Heldenfoto',
  'config.photo.subtitle': 'Lade ein klares Foto deines Helden hoch',
  'config.photo.uploaded': '✓ Foto erfolgreich hochgeladen!',
  'config.photo.replace': 'Foto ersetzen',
  'config.photo.hint': '💡 Stelle sicher, dass das Gesicht des Helden auf dem Foto gut sichtbar ist',
  'config.photo.upload': 'Klicken zum Hochladen',
  'config.photo.formats': 'PNG, JPG bis 10MB',
  'config.character.title': 'Charakterstil',
  'config.character.subtitle': 'Was für ein Charakter ist dein Held?',
  'config.character.superhero': 'Superheld',
  'config.character.superhero.desc': 'Klassischer Held mit Umhang und Superkräften',
  'config.character.adventurer': 'Abenteurer',
  'config.character.adventurer.desc': 'Entdecker bereit für jede Quest',
  'config.character.princess': 'Prinzessin',
  'config.character.princess.desc': 'Königlicher Charakter mit Eleganz',
  'config.character.fighter': 'Kämpfer',
  'config.character.fighter.desc': 'Krieger mit Kampf- und Strategiefähigkeiten',
  'config.character.magician': 'Magier',
  'config.character.magician.desc': 'Mystischer Zauberer mit magischen Kräften',
  'config.character.custom': 'Individuell',
  'config.character.custom.desc': 'Erstelle deinen eigenen Charaktertyp',
  'config.character.customLabel': 'Individueller Charakterstil',
  'config.character.customPlaceholder': 'Beschreibe deinen individuellen Charakterstil...',
  'config.story.title': 'Deine Geschichte',
  'config.story.subtitle': 'Beschreibe das Abenteuer, das dein Held erleben wird',
  'config.story.label': 'Geschichtsbeschreibung',
  'config.story.placeholder': 'Beschreibe deine Comic-Geschichte...',
  'config.story.language': 'Sprache',
  'config.story.language.english': 'Englisch',
  'config.story.language.german': 'Deutsch',
  'config.story.exampleTitle': '💡 Beispiel zur Inspiration:',
  'config.illustration.title': 'Illustrationsstil',
  'config.illustration.subtitle': 'Wähle den Kunststil für dein Comic',
  'config.illustration.superhero': 'Superhelden-Comic',
  'config.illustration.superhero.desc': 'Klassischer Superhelden-Look, sofort fesselnd',
  'config.illustration.cartoon': 'Cartoon-Stil',
  'config.illustration.cartoon.desc': 'Freundlich, farbenfroh, perfekt für Familiengeschenke',
  'config.illustration.manga': 'Japanischer Manga/Anime-Stil',
  'config.illustration.manga.desc': 'Dynamische Anime-inspirierte Kunst mit ausdrucksstarken Charakteren',
  'config.review.title': 'Überprüfen & Generieren',
  'config.review.subtitle': 'Überprüfe deine Comic-Details und generiere dein personalisiertes Comic-Buch',
  'config.review.basicInfo': 'Grundinformationen',
  'config.review.hero': 'Held',
  'config.review.title.label': 'Titel',
  'config.review.notSet': 'Nicht festgelegt',
  'config.review.heroPhoto': 'Heldenfoto',
  'config.review.noPhoto': 'Kein Foto hochgeladen',
  'config.review.characterStyle': 'Charakterstil',
  'config.review.notSelected': 'Nicht ausgewählt',
  'config.review.customNotDefined': 'Individueller Stil nicht definiert',
  'config.review.story': 'Geschichte',
  'config.review.noStory': 'Keine Geschichtsbeschreibung angegeben',
  'config.review.artStyle': 'Kunststil',
  'config.review.generate': 'Generieren',
  'config.review.completeAll': 'Bitte alle Abschnitte ausfüllen, um fortzufahren',
  'config.checkout.title': 'Kasse',
  'config.checkout.subtitle': 'Gib deine Daten ein, um dein Comic zu kaufen und zu generieren',
  'config.checkout.personalInfo': 'Persönliche Informationen',
  'config.checkout.firstName': 'Vorname',
  'config.checkout.lastName': 'Nachname',
  'config.checkout.email': 'E-Mail',
  'config.checkout.acceptTerms': 'Ich akzeptiere die',
  'config.checkout.termsLink': 'Allgemeinen Geschäftsbedingungen',
  'config.checkout.aiDisclaimer': '⚠️ KI-Inhaltshinweis',
  'config.checkout.aiDisclaimerText': 'Ich verstehe, dass dies ein KI-generiertes Comic-Buch ist und Unvollkommenheiten, Fehler oder unerwartete Ergebnisse enthalten kann. Es gibt keine Garantie für Perfektion.',
  'config.checkout.aiDisclaimerDe': '(I understand that this is an AI-generated comic and may contain errors. There is no guarantee of perfection.)',
  'config.checkout.orderSummary': 'Bestellübersicht',
  'config.checkout.digitalComic': 'Digitales Comic-Buch',
  'config.checkout.total': 'Gesamt',
  'config.checkout.button': 'Kaufen & Comic Generieren - 5,90 €',
  'config.checkout.processing': 'Verarbeite...',
  'config.checkout.fillAll': 'Bitte fülle alle Felder aus und akzeptiere beide Kontrollkästchen',
  'config.checkout.securePayment': 'Sichere Zahlung über Stripe',
  'config.navigation.previous': 'Zurück',
  'config.navigation.next': 'Weiter',
  'config.navigation.backToReview': 'Zurück zur Überprüfung',
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const [language, setLanguageState] = useState<Language>(() => {
    const pathLang = detectLanguageFromPath(window.location.pathname);
    if (pathLang) return pathLang;

    const queryLang = detectLanguageFromQuery();
    if (queryLang) return queryLang;

    const stored = localStorage.getItem('language') as Language;
    if (stored === 'en' || stored === 'de') {
      return stored;
    }

    return detectBrowserLanguage();
  });

  useEffect(() => {
    const pathLang = detectLanguageFromPath(location.pathname);
    if (pathLang && pathLang !== language) {
      setLanguageState(pathLang);
      localStorage.setItem('language', pathLang);
    }
  }, [location.pathname]);

  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('lang', language);

    const titleElement = document.querySelector('title');
    const descElement = document.querySelector('meta[name="description"]');
    const ogTitleElement = document.querySelector('meta[property="og:title"]');
    const ogDescElement = document.querySelector('meta[property="og:description"]');
    const ogLocaleElement = document.querySelector('meta[property="og:locale"]');
    const twitterTitleElement = document.querySelector('meta[name="twitter:title"]');
    const twitterDescElement = document.querySelector('meta[name="twitter:description"]');

    if (language === 'de') {
      if (titleElement) {
        titleElement.textContent = 'Personalisiertes Comic Erstellen | KI Comic Generator';
      }
      if (descElement) {
        descElement.setAttribute('content', 'Erstelle Dein personalisiertse Comic! Digital oder Gedruckt. Perfekt als Geschenk. Keine Anmeldung erforderlich.');
      }
      if (ogTitleElement) {
        ogTitleElement.setAttribute('content', 'Personalisiertes Comic Erstellen | KI Comic Generator');
      }
      if (ogDescElement) {
        ogDescElement.setAttribute('content', 'Erstelle Dein personalisiertse Comic! Digital oder Gedruckt. Perfekt als Geschenk. Keine Anmeldung erforderlich.');
      }
      if (ogLocaleElement) {
        ogLocaleElement.setAttribute('content', 'de_DE');
      }
      if (twitterTitleElement) {
        twitterTitleElement.setAttribute('content', 'Personalisiertes Comic Erstellen | KI Comic Generator');
      }
      if (twitterDescElement) {
        twitterDescElement.setAttribute('content', 'Erstellen Sie personalisierte KI Comic Bücher mit Ihrem Foto!. Comic Geschenk für besondere Anlässe.');
      }
    } else {
      if (titleElement) {
        titleElement.textContent = 'Create Personalized Comic Books | AI Comic Generator';
      }
      if (descElement) {
        descElement.setAttribute('content', 'Create your own comic book! Transform yourself into a superhero | No sign-up required.');
      }
      if (ogTitleElement) {
        ogTitleElement.setAttribute('content', 'Create Your Personalized Comic Book | AI Comic Generator');
      }
      if (ogDescElement) {
        ogDescElement.setAttribute('content', 'Transform yourself into a superhero! Create personalized AI comic books with your photo. Perfect gift for any occasion.');
      }
      if (ogLocaleElement) {
        ogLocaleElement.setAttribute('content', 'en_US');
      }
      if (twitterTitleElement) {
        twitterTitleElement.setAttribute('content', 'Create Personalized Comic Books | AI Comic Generator');
      }
      if (twitterDescElement) {
        twitterDescElement.setAttribute('content', 'Transform yourself into a superhero! Create personalized AI comic books with your photo. No Sign-up.');
      }
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    const translations = language === 'de' ? translationsDe : translationsEn;
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
