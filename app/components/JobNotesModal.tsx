"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Edit2, Save, Calendar, Unlock, RotateCcw } from "lucide-react";
import {
  getJobNotes,
  createJobNote,
  updateJobNote,
  type JobNote,
  getJobs,
  getJobsV2,
  updateJob,
  type Job,
  type TimeSplit,
} from "@/lib/api";
import { useUser } from "@/hooks/useUser";
import {
  type CellGranularity,
  type Period,
  convertWeeklyToGranularity,
  convertGranularityToWeekly,
  redistributeQuantity,
  resetToEvenDistribution,
  calculatePeriods,
} from "@/lib/granularityConversion";
import type { ParsedJob } from "@/hooks/useJobs";
import { parseJob } from "@/hooks/useJobs";

interface JobNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJobIds: number[];
  onSuccess?: () => void;
  jobs?: ParsedJob[]; // Optional: pass jobs directly to avoid refetching
}

export default function JobNotesModal({
  isOpen,
  onClose,
  selectedJobIds,
  onSuccess,
  jobs: providedJobs,
}: JobNotesModalProps) {
  const { user } = useUser();
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [jobs, setJobs] = useState<(Job | ParsedJob)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  // Weekly split state - Map of jobId to weekly split and locked weeks
  const [editedWeeklySplits, setEditedWeeklySplits] = useState<Map<number, number[]>>(new Map());
  const [editedLockedWeeks, setEditedLockedWeeks] = useState<Map<number, boolean[]>>(new Map());
  const [pendingRedistribution, setPendingRedistribution] = useState<{
    jobId: number;
    periodIndex: number;
    newValue: number;
  } | null>(null);
  const [showBackwardWarning, setShowBackwardWarning] = useState(false);

  // Granularity state
  const [selectedGranularity, setSelectedGranularity] = useState<CellGranularity>("weekly");
  const [displayPeriods, setDisplayPeriods] = useState<Map<number, Period[]>>(new Map());
  
  // Track if we're using v2 API data (for single job)
  const [usingV2Data, setUsingV2Data] = useState(false);

  // Get user's notes color or default
  const notesColor = user?.notes_color || "#000000";

  // Load existing notes and jobs for selected jobs
  useEffect(() => {
    if (isOpen && selectedJobIds.length > 0) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedJobIds, providedJobs]);

  // Helper function to convert time_split data to Period[] based on granularity
  const convertTimeSplitToPeriods = (
    timeSplit: TimeSplit,
    targetGranularity: CellGranularity
  ): Period[] => {
    console.log(`[convertTimeSplitToPeriods] Converting for granularity: ${targetGranularity}`, {
      hasDaily: !!timeSplit.daily,
      hasWeekly: !!timeSplit.weekly,
      hasMonthly: !!timeSplit.monthly,
      hasQuarterly: !!timeSplit.quarterly,
      dailyLength: timeSplit.daily?.length,
      weeklyLength: timeSplit.weekly?.length,
      monthlyLength: timeSplit.monthly?.length,
      quarterlyLength: timeSplit.quarterly?.length,
    });

    if (targetGranularity === "daily" && timeSplit.daily && timeSplit.daily.length > 0) {
      // Use daily data directly
      console.log(`[convertTimeSplitToPeriods] Using daily data, ${timeSplit.daily.length} days`);
      return timeSplit.daily.map((day) => {
        const date = new Date(day.date);
        return {
          startDate: date,
          endDate: date,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          quantity: day.quantity,
          isLocked: false,
        };
      });
    } else if (targetGranularity === "weekly" && timeSplit.weekly && timeSplit.weekly.length > 0) {
      // Use weekly data directly
      console.log(`[convertTimeSplitToPeriods] Using weekly data, ${timeSplit.weekly.length} weeks`);
      return timeSplit.weekly.map((week) => {
        const weekStart = new Date(week.week_start);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return {
          startDate: weekStart,
          endDate: weekEnd,
          label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
          quantity: week.quantity,
          isLocked: false,
        };
      });
    } else if (targetGranularity === "monthly" && timeSplit.monthly && timeSplit.monthly.length > 0) {
      // Use monthly data directly
      console.log(`[convertTimeSplitToPeriods] Using monthly data, ${timeSplit.monthly.length} months`);
      return timeSplit.monthly.map((month) => {
        const monthStart = new Date(month.month_start);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        return {
          startDate: monthStart,
          endDate: monthEnd,
          label: monthStart.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          quantity: month.quantity,
          isLocked: false,
        };
      });
    } else if (targetGranularity === "quarterly" && timeSplit.quarterly && timeSplit.quarterly.length > 0) {
      // Use quarterly data directly
      console.log(`[convertTimeSplitToPeriods] Using quarterly data, ${timeSplit.quarterly.length} quarters`);
      return timeSplit.quarterly.map((quarter) => {
        const quarterStart = new Date(quarter.year, (quarter.quarter - 1) * 3, 1);
        const quarterEnd = new Date(quarter.year, quarter.quarter * 3, 0);
        return {
          startDate: quarterStart,
          endDate: quarterEnd,
          label: `Q${quarter.quarter} ${quarter.year.toString().slice(-2)}`,
          quantity: quarter.quantity,
          isLocked: false,
        };
      });
    }

    // Fallback: if specific granularity not available, use daily and convert
    console.log(`[convertTimeSplitToPeriods] No direct data for ${targetGranularity}, trying fallback with daily data`);
    if (timeSplit.daily && timeSplit.daily.length > 0) {
      console.log(`[convertTimeSplitToPeriods] Using daily data as fallback, ${timeSplit.daily.length} days`);
      const sortedDaily = [...timeSplit.daily].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      const dates = sortedDaily.map((d) => new Date(d.date));
      const startDate = dates[0].getTime();
      const endDate = dates[dates.length - 1].getTime();

      // Convert daily to target granularity
      const weekPeriods = calculatePeriods(startDate, endDate, "weekly");
      const dailyQuantities = new Map<string, number>();
      sortedDaily.forEach((day) => {
        dailyQuantities.set(day.date, day.quantity);
      });

      const weeklySplit: number[] = [];
      weekPeriods.forEach((week) => {
        let weekQuantity = 0;
        let currentDay = new Date(week.startDate);
        const endDay = new Date(week.endDate);
        while (currentDay <= endDay) {
          const dateKey = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
          weekQuantity += dailyQuantities.get(dateKey) || 0;
          currentDay.setDate(currentDay.getDate() + 1);
        }
        weeklySplit.push(weekQuantity);
      });

      const result = convertWeeklyToGranularity(
        weeklySplit,
        Array(weeklySplit.length).fill(false),
        startDate,
        endDate,
        targetGranularity
      );
      console.log(`[convertTimeSplitToPeriods] Fallback conversion resulted in ${result.length} periods`);
      return result;
    }

    console.warn(`[convertTimeSplitToPeriods] No data available for granularity ${targetGranularity} and no daily data for fallback`);
    return [];
  };

  // Initialize display periods when jobs load or granularity changes
  useEffect(() => {
    if (jobs.length === 0) return;

    console.log(`[JobNotesModal] Initializing display periods for ${jobs.length} jobs, granularity: ${selectedGranularity}`);
    const newDisplayPeriods = new Map<number, Period[]>();
    jobs.forEach((job) => {
      // Check if this is a v2 job with time_split
      const jobWithTimeSplit = job as unknown as { time_split?: TimeSplit };
      
      console.log(`[JobNotesModal] Processing job ${job.id}:`, {
        hasTimeSplit: !!jobWithTimeSplit.time_split,
        timeSplitKeys: jobWithTimeSplit.time_split ? Object.keys(jobWithTimeSplit.time_split) : [],
        selectedGranularity,
      });
      
      if (jobWithTimeSplit.time_split) {
        // Use time_split data directly for the selected granularity
        console.log(`[JobNotesModal] Converting time_split for job ${job.id}, granularity: ${selectedGranularity}`);
        const periods = convertTimeSplitToPeriods(jobWithTimeSplit.time_split, selectedGranularity);
        console.log(`[JobNotesModal] Converted to ${periods.length} periods for job ${job.id}:`, periods.slice(0, 3));
        newDisplayPeriods.set(job.id, periods);
      } else {
        // Use weekly_split (existing logic)
        const weeklySplit = editedWeeklySplits.get(job.id) || job.weekly_split || [];
        const lockedWeeks = editedLockedWeeks.get(job.id) || job.locked_weeks || [];

        if (weeklySplit.length > 0) {
          // Use current date as fallback for missing dates
          const now = Date.now();
          const startDate = job.start_date || now;
          const dueDate = job.due_date || now + (7 * 24 * 60 * 60 * 1000 * weeklySplit.length);

          const periods = convertWeeklyToGranularity(
            weeklySplit,
            lockedWeeks,
            startDate,
            dueDate,
            selectedGranularity
          );
          newDisplayPeriods.set(job.id, periods);
        } else {
          console.warn(`[JobNotesModal] Job ${job.id} has no time_split.daily and no weekly_split`);
        }
      }
    });

    console.log(`[JobNotesModal] Setting displayPeriods with ${newDisplayPeriods.size} jobs`);
    setDisplayPeriods(newDisplayPeriods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, selectedGranularity, editedWeeklySplits, editedLockedWeeks]); // Trigger when edited splits change

  const loadData = async () => {
    setIsLoading(true);
    try {
      let selectedJobs: (Job | ParsedJob)[] = [];
      let v2DataUsed = false;

      // For single job, fetch from v2 API to get time_split data
      if (selectedJobIds.length === 1) {
        try {
          // Fetch from v2 API to get time_split data
          const jobId = selectedJobIds[0];
          console.log(`[JobNotesModal] Fetching job ${jobId} from v2 API`);
          const v2Response = await getJobsV2({ per_page: 1000 });
          console.log(`[JobNotesModal] V2 API returned ${v2Response.items.length} jobs`);
          
          const v2Job = v2Response.items.find((job) => job.id === jobId);
          console.log(`[JobNotesModal] Found job in v2 response:`, {
            found: !!v2Job,
            jobId: v2Job?.id,
            hasTimeSplit: !!v2Job?.time_split,
            timeSplitKeys: v2Job?.time_split ? Object.keys(v2Job.time_split) : [],
          });
          
          if (v2Job && v2Job.time_split) {
            // Convert v2 job to ParsedJob format and attach time_split
            const baseJob = {
              ...v2Job,
              machines_id: JSON.stringify((v2Job.machines_id || []).map((id) => ({ id, line: "" }))),
              machines: JSON.stringify((v2Job.machines_id || []).map((id) => ({ id, line: "" }))),
            };
            const parsedJob = parseJob(baseJob as any);
            (parsedJob as any).time_split = v2Job.time_split;
            
            selectedJobs = [parsedJob];
            v2DataUsed = true;
            setUsingV2Data(true);
            
            console.log(`[JobNotesModal] Loaded job ${v2Job.id} from v2 API with time_split:`, {
              hasDaily: !!v2Job.time_split.daily,
              hasWeekly: !!v2Job.time_split.weekly,
              hasMonthly: !!v2Job.time_split.monthly,
              hasQuarterly: !!v2Job.time_split.quarterly,
              dailyLength: v2Job.time_split.daily?.length,
              weeklyLength: v2Job.time_split.weekly?.length,
              monthlyLength: v2Job.time_split.monthly?.length,
              quarterlyLength: v2Job.time_split.quarterly?.length,
              timeSplit: v2Job.time_split,
            });
            console.log(`[JobNotesModal] Parsed job after attaching time_split:`, {
              id: parsedJob.id,
              hasTimeSplit: !!(parsedJob as any).time_split,
              timeSplitKeys: (parsedJob as any).time_split ? Object.keys((parsedJob as any).time_split) : [],
            });
          } else {
            console.warn(`[JobNotesModal] Job ${jobId} not found in v2 response or has no time_split, using fallback`);
            // Fallback to provided jobs or v1 API
            if (providedJobs && providedJobs.length > 0) {
              selectedJobs = providedJobs.filter((job) =>
                selectedJobIds.includes(job.id)
              );
              console.log(`[JobNotesModal] Using providedJobs fallback, found ${selectedJobs.length} jobs`);
            } else {
              const allJobs = await getJobs();
              selectedJobs = allJobs.filter((job) =>
                selectedJobIds.includes(job.id)
              );
              console.log(`[JobNotesModal] Using v1 API fallback, found ${selectedJobs.length} jobs`);
            }
            setUsingV2Data(false);
          }
        } catch (v2Error) {
          console.warn("Failed to load from v2 API, falling back:", v2Error);
          // Fallback to provided jobs or v1 API
          if (providedJobs && providedJobs.length > 0) {
            selectedJobs = providedJobs.filter((job) =>
              selectedJobIds.includes(job.id)
            );
          } else {
            const allJobs = await getJobs();
            selectedJobs = allJobs.filter((job) =>
              selectedJobIds.includes(job.id)
            );
          }
          setUsingV2Data(false);
        }
      } else {
        // Multiple jobs - use provided jobs or fetch from v1 API
        if (providedJobs && providedJobs.length > 0) {
          selectedJobs = providedJobs.filter((job) =>
            selectedJobIds.includes(job.id)
          );
        } else {
          const allJobs = await getJobs();
          selectedJobs = allJobs.filter((job) =>
            selectedJobIds.includes(job.id)
          );
        }
        setUsingV2Data(false);
      }

      // Load notes
      const allNotes = await getJobNotes();

      // Filter notes that include any of the selected job IDs
      const relevantNotes = allNotes.filter((note) =>
        note.jobs_id.some((jobId) => selectedJobIds.includes(jobId)),
      );
      setNotes(relevantNotes);

      setJobs(selectedJobs);

      // Initialize weekly split state from jobs (useEffect will handle displayPeriods)
      // Only initialize if not using v2 data (v2 data uses daily_split directly)
      if (!v2DataUsed) {
        const newWeeklySplits = new Map<number, number[]>();
        const newLockedWeeks = new Map<number, boolean[]>();

        selectedJobs.forEach((job) => {
          if (job.weekly_split && job.weekly_split.length > 0) {
            newWeeklySplits.set(job.id, [...job.weekly_split]);
            newLockedWeeks.set(job.id, job.locked_weeks ? [...job.locked_weeks] : []);
          } else if (job.start_date && job.due_date) {
            // Initialize with even distribution if no weekly_split exists
            const weeks = Math.ceil(
              (job.due_date - job.start_date) / (7 * 24 * 60 * 60 * 1000)
            );
            const numWeeks = Math.max(1, weeks);
            const { quantities, locks } = resetToEvenDistribution(numWeeks, job.quantity);
            newWeeklySplits.set(job.id, quantities);
            newLockedWeeks.set(job.id, locks);
          } else {
            // Job missing start_date or due_date - log warning but still initialize with 1 week
            console.warn(
              `[JobNotesModal] Job #${job.job_number} (ID: ${job.id}) is missing start_date or due_date. Initializing with 1 week default.`,
              { start_date: job.start_date, due_date: job.due_date }
            );
            const { quantities, locks } = resetToEvenDistribution(1, job.quantity);
            newWeeklySplits.set(job.id, quantities);
            newLockedWeeks.set(job.id, locks);
          }
        });

        setEditedWeeklySplits(newWeeklySplits);
        setEditedLockedWeeks(newLockedWeeks);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      alert("Failed to load data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const allNotes = await getJobNotes();
      const relevantNotes = allNotes.filter((note) =>
        note.jobs_id.some((jobId) => selectedJobIds.includes(jobId)),
      );
      setNotes(relevantNotes);
    } catch (error) {
      console.error("Failed to load notes:", error);
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

  // Granularity change handler
  const handleGranularityChange = (newGranularity: CellGranularity) => {
    setSelectedGranularity(newGranularity);

    // Convert all jobs to new granularity
    const newDisplayPeriods = new Map<number, Period[]>();
    jobs.forEach((job) => {
      // Check if this is a v2 job with time_split
      const jobWithTimeSplit = job as unknown as { time_split?: TimeSplit };
      if (jobWithTimeSplit.time_split) {
        // Use time_split data directly for the selected granularity
        const periods = convertTimeSplitToPeriods(jobWithTimeSplit.time_split, newGranularity);
        newDisplayPeriods.set(job.id, periods);
      } else {
        // Use weekly_split (existing logic)
        const weeklySplit = editedWeeklySplits.get(job.id) || job.weekly_split || [];
        const lockedWeeks = editedLockedWeeks.get(job.id) || job.locked_weeks || [];

        if (weeklySplit.length > 0) {
          // Use current date as fallback for missing dates
          const now = Date.now();
          const startDate = job.start_date || now;
          const dueDate = job.due_date || now + (7 * 24 * 60 * 60 * 1000 * weeklySplit.length);

          const periods = convertWeeklyToGranularity(
            weeklySplit,
            lockedWeeks,
            startDate,
            dueDate,
            newGranularity
          );
          newDisplayPeriods.set(job.id, periods);
        }
      }
    });
    setDisplayPeriods(newDisplayPeriods);
  };

  // Period split handlers
  const handlePeriodChange = (jobId: number, periodIndex: number, value: string) => {
    const cleanedValue = value.replace(/,/g, "");
    const newValue = parseInt(cleanedValue) || 0;
    performRedistribution(jobId, periodIndex, newValue, false);
  };

  const performRedistribution = (
    jobId: number,
    periodIndex: number,
    newValue: number,
    allowBackward: boolean
  ) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const currentPeriods = displayPeriods.get(jobId) || [];
    if (currentPeriods.length === 0) return;

    // Check if redistribution would need to go backward
    const unlockedPeriodsAfter = currentPeriods
      .map((_, idx) => idx)
      .filter((idx) => idx > periodIndex && !currentPeriods[idx].isLocked);

    if (unlockedPeriodsAfter.length === 0 && !allowBackward) {
      setPendingRedistribution({ jobId, periodIndex, newValue });
      setShowBackwardWarning(true);
      return;
    }

    const newPeriods = redistributeQuantity(
      currentPeriods,
      periodIndex,
      newValue,
      job.quantity,
      allowBackward
    );

    setDisplayPeriods(new Map(displayPeriods.set(jobId, newPeriods)));

    // Convert back to weekly_split for storage
    const { weekly_split, locked_weeks } = convertGranularityToWeekly(
      newPeriods,
      job.start_date,
      job.due_date,
      selectedGranularity,
      job.quantity
    );

    setEditedWeeklySplits(new Map(editedWeeklySplits.set(jobId, weekly_split)));
    setEditedLockedWeeks(new Map(editedLockedWeeks.set(jobId, locked_weeks)));
  };

  const handleBackwardRedistributeConfirm = () => {
    if (pendingRedistribution) {
      performRedistribution(
        pendingRedistribution.jobId,
        pendingRedistribution.periodIndex,
        pendingRedistribution.newValue,
        true
      );
      setPendingRedistribution(null);
    }
    setShowBackwardWarning(false);
  };

  const handleBackwardRedistributeCancel = () => {
    setPendingRedistribution(null);
    setShowBackwardWarning(false);
  };

  const handleUnlockPeriod = (jobId: number, periodIndex: number) => {
    const currentPeriods = displayPeriods.get(jobId) || [];
    const newPeriods = [...currentPeriods];
    newPeriods[periodIndex] = { ...newPeriods[periodIndex], isLocked: false };
    setDisplayPeriods(new Map(displayPeriods.set(jobId, newPeriods)));

    // Also update weekly locks if in weekly mode
    if (selectedGranularity === "weekly") {
      const currentLocked = editedLockedWeeks.get(jobId) || [];
      const newLockedWeeks = [...currentLocked];
      newLockedWeeks[periodIndex] = false;
      setEditedLockedWeeks(new Map(editedLockedWeeks.set(jobId, newLockedWeeks)));
    }
  };

  const handleResetToEvenDistribution = (jobId: number) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const currentPeriods = displayPeriods.get(jobId) || [];
    const { quantities, locks } = resetToEvenDistribution(
      currentPeriods.length,
      job.quantity
    );

    const newPeriods = currentPeriods.map((period, idx) => ({
      ...period,
      quantity: quantities[idx],
      isLocked: locks[idx],
    }));

    setDisplayPeriods(new Map(displayPeriods.set(jobId, newPeriods)));

    // Convert back to weekly_split
    const { weekly_split, locked_weeks } = convertGranularityToWeekly(
      newPeriods,
      job.start_date,
      job.due_date,
      selectedGranularity,
      job.quantity
    );

    setEditedWeeklySplits(new Map(editedWeeklySplits.set(jobId, weekly_split)));
    setEditedLockedWeeks(new Map(editedLockedWeeks.set(jobId, locked_weeks)));
  };

  const handleSaveWeeklySplits = async () => {
    setIsSaving(true);
    try {
      const updates = jobs.map(async (job) => {
        const weeklySplit = editedWeeklySplits.get(job.id);
        const lockedWeeks = editedLockedWeeks.get(job.id);

        if (weeklySplit) {
          await updateJob(job.id, {
            weekly_split: weeklySplit,
            locked_weeks: lockedWeeks || [],
          });
        }
      });

      await Promise.all(updates);
      alert("Weekly projections saved successfully!");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to save weekly splits:", error);
      alert("Failed to save weekly projections. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-[var(--dark-blue)]">
            Job Notes & Projections ({selectedJobIds.length} job{selectedJobIds.length > 1 ? "s" : ""})
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
              <p className="mt-4 text-[var(--text-light)]">Loading data...</p>
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

              {/* Projections Section */}
              {jobs.length > 0 && (
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[var(--primary-blue)]" />
                      <h3 className="text-lg font-semibold text-[var(--dark-blue)]">
                        Quantity Projections
                      </h3>
                    </div>
                    {/* Granularity Selector */}
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                      {(["daily", "weekly", "monthly", "quarterly"] as CellGranularity[]).map((gran) => (
                        <button
                          key={gran}
                          onClick={() => handleGranularityChange(gran)}
                          disabled={isSaving}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            selectedGranularity === gran
                              ? "bg-white text-[var(--primary-blue)] shadow-sm"
                              : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                          } disabled:opacity-50 disabled:cursor-not-allowed capitalize`}
                        >
                          {gran}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    {jobs.map((job) => {
                      const periods = displayPeriods.get(job.id) || [];
                      const projectedTotal = periods.reduce((sum, p) => sum + p.quantity, 0);
                      const jobWithTimeSplit = job as unknown as { time_split?: TimeSplit };
                      const usingTimeSplit = !!jobWithTimeSplit.time_split;
                      
                      // For time_split data, use the projected total as the source of truth
                      // For regular jobs, compare to job.quantity
                      const expectedTotal = usingTimeSplit ? projectedTotal : job.quantity;
                      const totalMismatch = !usingTimeSplit && projectedTotal !== job.quantity;
                      const percentage = job.quantity > 0 ? ((projectedTotal / job.quantity) * 100).toFixed(1) : "0";

                      console.log(`[JobNotesModal] Rendering job ${job.id}:`, {
                        periodsLength: periods.length,
                        periods: periods,
                        displayPeriodsSize: displayPeriods.size,
                        jobHasTimeSplit: usingTimeSplit,
                        projectedTotal,
                        jobQuantity: job.quantity,
                        usingTimeSplit,
                      });

                      // Show loading state if periods haven't loaded yet
                      if (periods.length === 0) {
                        return (
                          <div key={job.id} className="border border-[var(--border)] rounded-lg p-4 bg-gray-50">
                            <p className="text-sm text-gray-500">Loading projections for Job #{job.job_number}...</p>
                          </div>
                        );
                      }

                      return (
                        <div key={job.id} className="border border-[var(--border)] rounded-lg p-4 bg-gray-50">
                          {/* Job Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-sm font-medium text-[var(--text-dark)]">
                                Job #{job.job_number} - {job.job_name}
                              </h3>
                              <div className="text-xs text-[var(--text-light)] mt-1 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-[var(--text-dark)]">
                                    Projected Total: {projectedTotal.toLocaleString()}
                                  </span>
                                  {usingTimeSplit && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                                      From Timeline
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[var(--text-light)]">
                                  <span>Job Quantity: {job.quantity.toLocaleString()}</span>
                                  {selectedGranularity === "weekly" && (
                                    <span>• {periods.length} {periods.length === 1 ? "week" : "weeks"}</span>
                                  )}
                                  {selectedGranularity === "monthly" && (
                                    <span>• {periods.length} {periods.length === 1 ? "month" : "months"}</span>
                                  )}
                                  {selectedGranularity === "quarterly" && (
                                    <span>• {periods.length} {periods.length === 1 ? "quarter" : "quarters"}</span>
                                  )}
                                  {selectedGranularity === "daily" && (
                                    <span>• {periods.length} {periods.length === 1 ? "day" : "days"}</span>
                                  )}
                                  {!usingTimeSplit && totalMismatch && (
                                    <span className="text-amber-600 font-medium">
                                      ({percentage}% of job quantity)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleResetToEvenDistribution(job.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-white transition-colors"
                              title="Reset to even distribution"
                              disabled={isSaving}
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reset
                            </button>
                          </div>

                          {/* Period Split Grid - Use horizontal scroll for many weekly periods */}
                          <div className={
                            selectedGranularity === "weekly" && periods.length > 12
                              ? "flex gap-4 mb-4 overflow-x-auto pb-2 p-3 bg-gray-50 rounded-lg"
                              : `grid gap-4 mb-4 p-3 bg-gray-50 rounded-lg ${
                                  selectedGranularity === "daily"
                                    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-7"
                                    : selectedGranularity === "weekly"
                                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
                                    : selectedGranularity === "monthly"
                                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                                }`
                          }>
                            {periods.map((period, periodIndex) => {
                              const isLocked = period.isLocked || false;
                              const useHorizontalScroll = selectedGranularity === "weekly" && periods.length > 12;

                              return (
                                <div
                                  key={periodIndex}
                                  className={`relative border rounded-lg p-2 shadow-sm ${
                                    isLocked ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"
                                  } ${useHorizontalScroll ? "flex-shrink-0 w-40 min-w-[160px]" : ""}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-[var(--text-dark)]">
                                      {period.label}
                                    </span>
                                    {isLocked && (
                                      <button
                                        onClick={() => handleUnlockPeriod(job.id, periodIndex)}
                                        className="p-0.5 text-blue-600 hover:text-blue-800 transition-opacity hover:opacity-70"
                                        title="Unlock this period to allow auto-redistribution"
                                        disabled={isSaving}
                                      >
                                        <Unlock className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={(period.quantity || 0).toLocaleString()}
                                      onChange={(e) => handlePeriodChange(job.id, periodIndex, e.target.value)}
                                      disabled={isSaving}
                                      className={`w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                        isLocked
                                          ? "bg-blue-50 border-blue-300 font-semibold pr-7"
                                          : "border-gray-300"
                                      }`}
                                      title={
                                        isLocked
                                          ? "This period is locked and won't be auto-adjusted"
                                          : "Edit to lock this period"
                                      }
                                    />
                                    {isLocked && (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="#2563eb"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-[var(--text-light)] mt-1">
                                    {job.quantity > 0 ? (((period.quantity || 0) / job.quantity) * 100).toFixed(1) : 0}%
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Visual Progress Bar */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-[var(--text-light)]">
                              <Calendar className="w-3 h-3" />
                              <span>Distribution Timeline</span>
                            </div>
                            <div className="flex h-6 rounded-lg overflow-hidden bg-gray-200">
                              {periods.map((period, idx) => {
                                const percentage = job.quantity > 0 ? (period.quantity / job.quantity) * 100 : 0;
                                if (percentage === 0) return null;

                                const isLocked = period.isLocked || false;

                                return (
                                  <div
                                    key={idx}
                                    style={{ width: `${percentage}%` }}
                                    className={`flex items-center justify-center text-xs text-white font-medium ${
                                      isLocked ? "bg-blue-500" : "bg-[var(--primary-blue)]"
                                    }`}
                                    title={`${period.label}: ${period.quantity.toLocaleString()} (${percentage.toFixed(1)}%)`}
                                  >
                                    {percentage > 8 && period.label}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Save Button for Projections */}
                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <button
                        onClick={handleSaveWeeklySplits}
                        disabled={isSaving}
                        className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-[var(--dark-blue)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save Quantity Projections</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Backward Redistribution Warning Dialog */}
      {showBackwardWarning && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/30" onClick={handleBackwardRedistributeCancel} />
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative z-10">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-3">
              Redistribute Past Weeks?
            </h3>
            <p className="text-sm text-[var(--text-dark)] mb-4">
              No unlocked weeks available after this week. Do you want to redistribute the difference across past weeks?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleBackwardRedistributeCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-[var(--text-dark)] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBackwardRedistributeConfirm}
                className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-[var(--dark-blue)] transition-colors"
              >
                Redistribute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

