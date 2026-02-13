'use client';

/**
 * Save Scenario Dialog — Sprint 12.2
 *
 * Modal dialog for saving a scenario with name and description.
 * All UI text from sandboxLabels (NL).
 */

import { useState } from 'react';
import { SAVE_DIALOG } from '@/lib/ui/sandboxLabels';

interface SaveScenarioDialogProps {
  onSave: (name: string, description?: string) => void;
  onCancel: () => void;
}

export function SaveScenarioDialog({
  onSave,
  onCancel,
}: SaveScenarioDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      alert(SAVE_DIALOG.nameRequired);
      return;
    }
    onSave(name.trim(), description.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {SAVE_DIALOG.title}
          </h3>

          <div className="space-y-4">
            {/* Name field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {SAVE_DIALOG.nameLabel}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={SAVE_DIALOG.namePlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Description field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {SAVE_DIALOG.descriptionLabel}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={SAVE_DIALOG.descriptionPlaceholder}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              {SAVE_DIALOG.save}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              {SAVE_DIALOG.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
