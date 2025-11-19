"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Edit2, Save } from "lucide-react";
import {
  getJobNotes,
  createJobNote,
  updateJobNote,
  type JobNote,
} from "@/lib/api";
import { useUser } from "@/hooks/useUser";

interface JobNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJobIds: number[];
  onSuccess?: () => void;
}

export default function JobNotesModal({
  isOpen,
  onClose,
  selectedJobIds,
  onSuccess,
}: JobNotesModalProps) {
  const { user } = useUser();
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  // Get user's notes color or default
  const notesColor = user?.notes_color || "#000000";

  // Load existing notes for selected jobs
  useEffect(() => {
    if (isOpen && selectedJobIds.length > 0) {
      loadNotes();
    }
  }, [isOpen, selectedJobIds]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const allNotes = await getJobNotes();
      // Filter notes that include any of the selected job IDs
      const relevantNotes = allNotes.filter((note) =>
        note.jobs_id.some((jobId) => selectedJobIds.includes(jobId)),
      );
      setNotes(relevantNotes);
    } catch (error) {
      console.error("Failed to load notes:", error);
      alert("Failed to load notes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) {
      alert("Please enter a note.");
      return;
    }

    setIsSaving(true);
    try {
      await createJobNote({
        jobs_id: selectedJobIds,
        notes: newNoteText.trim(),
      });
      setNewNoteText("");
      await loadNotes();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to add note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (note: JobNote) => {
    setEditingNoteId(note.id || null);
    setEditingText(note.notes);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingText("");
  };

  const handleSaveEdit = async (noteId: number | undefined) => {
    if (!noteId) {
      console.error("Note ID is undefined");
      alert("Cannot save: Note ID is missing.");
      return;
    }

    if (!editingText.trim()) {
      alert("Note cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        console.error("Note not found:", noteId);
        alert("Note not found. Please refresh and try again.");
        setIsSaving(false);
        return;
      }

      console.log("Updating note:", noteId, { jobs_id: note.jobs_id, notes: editingText.trim() });
      await updateJobNote(noteId, {
        jobs_id: note.jobs_id,
        notes: editingText.trim(),
      });
      setEditingNoteId(null);
      setEditingText("");
      await loadNotes();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to update note:", error);
      alert(`Failed to update note: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: number | undefined) => {
    if (!noteId) {
      console.error("Note ID is undefined");
      alert("Cannot delete: Note ID is missing.");
      return;
    }

    if (!confirm("Are you sure you want to remove this note from the selected jobs?")) {
      return;
    }

    setIsSaving(true);
    try {
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        console.error("Note not found:", noteId);
        alert("Note not found. Please refresh and try again.");
        setIsSaving(false);
        return;
      }

      // Remove selected job IDs from the note's jobs_id array
      const updatedJobsId = note.jobs_id.filter(
        (jobId) => !selectedJobIds.includes(jobId)
      );

      console.log("Removing note from jobs:", noteId, {
        originalJobsId: note.jobs_id,
        updatedJobsId,
        selectedJobIds,
      });

      // Update the note with the new jobs_id list
      await updateJobNote(noteId, {
        jobs_id: updatedJobsId,
        notes: note.notes,
      });

      await loadNotes();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to remove note:", error);
      alert(`Failed to remove note: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-[var(--dark-blue)]">
            Job Notes ({selectedJobIds.length} job{selectedJobIds.length > 1 ? "s" : ""})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-blue)] mx-auto"></div>
              <p className="mt-4 text-[var(--text-light)]">Loading notes...</p>
            </div>
          ) : (
            <>
              {/* Existing Notes */}
              <div className="space-y-4 mb-6">
                {notes.length === 0 ? (
                  <p className="text-[var(--text-light)] text-center py-8">
                    No notes yet. Add a note below.
                  </p>
                ) : (
                  notes.map((note, index) => (
                    <div
                      key={note.id || `note-${index}-${note.notes.substring(0, 20)}`}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      {editingNoteId === note.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] resize-none"
                            rows={3}
                            disabled={isSaving}
                          />
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-[var(--text-light)]">
                              {note.created_at &&
                                new Date(note.created_at).toLocaleString()}
                              {note.name && ` • ${note.name}`}
                              {note.email && ` (${note.email})`}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                disabled={isSaving}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit(note.id);
                                }}
                                disabled={isSaving || !note.id}
                                className="px-3 py-1.5 text-sm bg-[var(--primary-blue)] text-white rounded hover:bg-[var(--dark-blue)] disabled:opacity-50 flex items-center gap-1"
                              >
                                <Save className="w-4 h-4" />
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <p
                              className="flex-1 text-[var(--text-dark)] whitespace-pre-wrap"
                              style={{ color: note.color || notesColor }}
                            >
                              {note.notes}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(note);
                                }}
                                disabled={isSaving}
                                className="p-1.5 text-gray-600 hover:text-[var(--primary-blue)] transition-colors disabled:opacity-50"
                                title="Edit note"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNote(note.id);
                                }}
                                disabled={isSaving || !note.id}
                                className="p-1.5 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                                title="Delete note"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-[var(--text-light)]">
                            {note.created_at &&
                              new Date(note.created_at).toLocaleString()}
                            {note.name && ` • ${note.name}`}
                            {note.email && ` (${note.email})`}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add New Note */}
              <div className="border-t border-gray-200 pt-6">
                <label className="block text-sm font-medium text-[var(--text-dark)] mb-2">
                  Add New Note
                </label>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Enter your note here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] resize-none"
                  rows={4}
                  disabled={isSaving}
                  style={{ color: notesColor }}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-[var(--text-light)]">
                    Note will be added to all {selectedJobIds.length} selected job
                    {selectedJobIds.length > 1 ? "s" : ""}
                  </div>
                  <button
                    onClick={handleAddNote}
                    disabled={isSaving || !newNoteText.trim()}
                    className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-[var(--dark-blue)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add Note</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-[var(--text-dark)] hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

