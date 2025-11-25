import { useState, useCallback } from "react";
import type { JobNote } from "@/lib/api";
import { getJobNotes, createJobNote, updateJobNote } from "@/lib/api";
import { getCellKey, getPeriodKey, type CellIdentifier } from "@/types";

/**
 * Custom hook for managing cell-level notes with incremental updates
 * This hook maintains a map of cell notes keyed by cell identifier
 * and provides functions to create, update, and delete notes without full reloads
 */
export function useCellNotes() {
  // State: Map of cellKey -> array of notes for that cell
  const [cellNotesMap, setCellNotesMap] = useState<Map<string, JobNote[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load all notes from the API and organize them by cell
   */
  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const allNotes = await getJobNotes();

      // Filter valid notes
      const validNotes = allNotes.filter(
        (note) =>
          note &&
          note.notes &&
          typeof note.notes === "string" &&
          note.notes.trim().length > 0
      );

      // Create map: cellKey -> array of notes
      const notesMap = new Map<string, JobNote[]>();

      validNotes.forEach((note) => {
        if (note.is_cell_note && note.cell_job_id && note.cell_period_key) {
          // Cell-level note
          const cellKey = `${note.cell_job_id}:${note.cell_period_key}`;
          if (!notesMap.has(cellKey)) {
            notesMap.set(cellKey, []);
          }
          notesMap.get(cellKey)!.push(note);
        } else if (Array.isArray(note.jobs_id) && note.jobs_id.length > 0) {
          // Legacy job-level note - could optionally be handled here
          // For now, we'll skip job-level notes in this hook
        }
      });

      setCellNotesMap(notesMap);
    } catch (error) {
      console.error("[useCellNotes] Error loading notes:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get notes for a specific cell
   */
  const getNotesForCell = useCallback(
    (cellId: CellIdentifier): JobNote[] => {
      const cellKey = getCellKey(cellId);
      return cellNotesMap.get(cellKey) || [];
    },
    [cellNotesMap]
  );

  /**
   * Create a new cell-level note (incremental update)
   */
  const createCellNote = useCallback(
    async (cellId: CellIdentifier, noteText: string): Promise<JobNote> => {
      const periodKey = getPeriodKey(cellId);

      const newNote = await createJobNote({
        jobs_id: [cellId.jobId],
        notes: noteText,
        is_cell_note: true,
        cell_job_id: cellId.jobId,
        cell_period_key: periodKey,
        cell_period_label: cellId.periodLabel,
        cell_granularity: cellId.granularity,
      });

      // Incremental update - only update the specific cell
      const cellKey = getCellKey(cellId);
      setCellNotesMap((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(cellKey) || [];
        updated.set(cellKey, [...existing, newNote]);
        return updated;
      });

      return newNote;
    },
    []
  );

  /**
   * Update an existing cell note (incremental update)
   */
  const updateCellNote = useCallback(
    async (
      noteId: number,
      cellId: CellIdentifier,
      noteText: string
    ): Promise<JobNote> => {
      const periodKey = getPeriodKey(cellId);

      const updatedNote = await updateJobNote(noteId, {
        jobs_id: [cellId.jobId],
        notes: noteText,
        is_cell_note: true,
        cell_job_id: cellId.jobId,
        cell_period_key: periodKey,
        cell_period_label: cellId.periodLabel,
        cell_granularity: cellId.granularity,
      });

      // Incremental update - only update the specific cell
      const cellKey = getCellKey(cellId);
      setCellNotesMap((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(cellKey) || [];
        const updatedList = existing.map((note) =>
          note.id === noteId ? updatedNote : note
        );
        updated.set(cellKey, updatedList);
        return updated;
      });

      return updatedNote;
    },
    []
  );

  /**
   * Delete a cell note (incremental update)
   * Removes the note from the cell's notes array
   */
  const deleteCellNote = useCallback(
    (noteId: number, cellId: CellIdentifier) => {
      const cellKey = getCellKey(cellId);
      setCellNotesMap((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(cellKey) || [];
        const filtered = existing.filter((note) => note.id !== noteId);
        if (filtered.length > 0) {
          updated.set(cellKey, filtered);
        } else {
          updated.delete(cellKey);
        }
        return updated;
      });
    },
    []
  );

  /**
   * Check if a cell has any notes
   */
  const cellHasNotes = useCallback(
    (cellId: CellIdentifier): boolean => {
      const cellKey = getCellKey(cellId);
      const notes = cellNotesMap.get(cellKey);
      return notes !== undefined && notes.length > 0;
    },
    [cellNotesMap]
  );

  return {
    cellNotesMap,
    isLoading,
    loadNotes,
    getNotesForCell,
    createCellNote,
    updateCellNote,
    deleteCellNote,
    cellHasNotes,
  };
}
