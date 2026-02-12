import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-oranje-600 mb-4">
          OIL
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          Oranjehoen Intelligence Layer
        </p>
        <p className="text-gray-500 mb-8">
          Commerciële cockpit voor vierkantsverwaarding en massabalans
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/oil"
            className="inline-flex items-center justify-center rounded-lg bg-oranje-500 px-6 py-3 text-white font-medium hover:bg-oranje-600 transition-colors"
          >
            Open Dashboard
          </Link>

          <Link
            href="/oil/batches"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Bekijk Batches
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-4 rounded-lg bg-white border">
            <h3 className="font-semibold text-gray-900 mb-1">Massabalans</h3>
            <p className="text-sm text-gray-500">
              Track yields van levend naar griller naar snijdelen
            </p>
          </div>
          <div className="p-4 rounded-lg bg-white border">
            <h3 className="font-semibold text-gray-900 mb-1">SVASO Allocatie</h3>
            <p className="text-sm text-gray-500">
              Kostprijsberekening op basis van marktwaarde
            </p>
          </div>
          <div className="p-4 rounded-lg bg-white border">
            <h3 className="font-semibold text-gray-900 mb-1">Cherry Picker</h3>
            <p className="text-sm text-gray-500">
              Detecteer klanten met scheve afname
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
