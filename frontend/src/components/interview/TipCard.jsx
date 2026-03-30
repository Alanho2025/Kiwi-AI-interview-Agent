import { Card, CardContent } from '../common/Card.jsx';
import { Lightbulb } from 'lucide-react';

export function TipCard({ title, description }) {
  return (
    <Card className="bg-[#fffdf5] border-yellow-200">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-yellow-600">
          <Lightbulb className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Tip: {title}</h3>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
}
