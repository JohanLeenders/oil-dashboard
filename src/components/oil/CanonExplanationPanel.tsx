'use client';

import { useState } from 'react';

interface ExplanationItem {
  question: string;
  answer: string;
}

const EXPLANATIONS: ExplanationItem[] = [
  {
    question: 'Wat is SVASO?',
    answer:
      'SVASO (Schaduwprijs-gebaseerde Verdeling en Allocatie van Slachtopbrengsten) is een methode om de gezamenlijke kosten van het slachtproces te verdelen over de drie hoofddelen: borstlap, poot en vleugels. De verdeling is gebaseerd op de relatieve schaduwprijzen (marktwaarde) van elk deel, zodat duurdere delen een groter deel van de kosten dragen.',
  },
  {
    question: 'Waarom een flat rate voor bijproducten?',
    answer:
      'Bijproducten (bloed, veren, organen, rug/karkas) worden gecrediteerd tegen een vast tarief van \u20AC0,20/kg. Dit is een bewuste vereenvoudiging: bijproductprijzen fluctueren sterk en zijn moeilijk per batch te bepalen. De flat rate zorgt voor stabiliteit en voorspelbaarheid in de kostprijsberekening.',
  },
  {
    question: 'Wat is de k-factor?',
    answer:
      'De k-factor = C_netto_joint / TMV (Totale Marktwaarde). Een k-factor < 1 betekent dat de netto gezamenlijke kosten lager zijn dan de marktwaarde van de producten (winstgevend). Een k-factor > 1 duidt op verlies. Bij k = 1 is er break-even.',
  },
  {
    question: 'Hoe werkt Mini-SVASO?',
    answer:
      'Mini-SVASO past hetzelfde SVASO-principe toe op sub-niveau. Bijvoorbeeld: de kosten die aan "poot" zijn toegewezen, worden verder verdeeld over dijfilet en drumvlees op basis van hun relatieve schaduwprijzen. Dit geeft een nauwkeurige kostprijs per sub-cut.',
  },
  {
    question: 'Wat zijn schaduwprijzen?',
    answer:
      'Schaduwprijzen zijn de afgeleide marktwaarden die gebruikt worden voor kostenverdeling. Ze worden NOOIT handmatig ingevoerd, maar automatisch afgeleid van verkoopprijzen en rendementen. In scenario-modus kun je verkoopprijzen wijzigen (Level 7), waarna schaduwprijzen automatisch herberekend worden.',
  },
  {
    question: 'Wat zijn extra bewerkingen?',
    answer:
      'Extra bewerkingen (Level 6b) zijn downstream transformaties zoals extern verpakken, malen of worstmaken. Ze zijn additief en beinvloeden NOOIT de SVASO-allocatie. Extra bewerkingen zijn alleen beschikbaar in scenario-modus om what-if analyses te doen.',
  },
  {
    question: 'Hoe werkt de massabalans?',
    answer:
      'De massabalans controleert of het totale gewicht van hoofdproducten + bijproducten overeenkomt met het grillergewicht. Afwijking \u22643% is OK (\uD83D\uDFE2), 3-7,5% geeft een waarschuwing (\uD83D\uDFE1), en >7,5% blokkeert scenario-analyse (\u26D4). Bij blokkering is een admin override nodig.',
  },
];

export function CanonExplanationPanel() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4">
        Canon Uitleg
      </h3>

      <div className="space-y-1">
        {EXPLANATIONS.map((item, i) => (
          <div key={i} className="border border-gray-100 rounded-lg">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-800">
                {item.question}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${openIndex === i ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {openIndex === i && (
              <div className="px-4 pb-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
