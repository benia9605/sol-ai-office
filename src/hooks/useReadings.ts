/**
 * @file src/hooks/useReadings.ts
 * @description 독서 + 스터디 노트 데이터 관리 훅
 * - Supabase 연동 (readings + reading_logs 테이블)
 * - Supabase 미설정 시 더미 데이터 폴백
 * - 낙관적 업데이트 + 에러 롤백
 */
import { useState, useEffect, useCallback } from 'react';
import { ReadingItem, StudyNote, NoteSection, NoteActionItem } from '../types';
import { dummyReadings, dummyStudyNotes } from '../data';
import {
  fetchReadings, addReading as addReadingDb, updateReading as updateReadingDb,
  deleteReading as deleteReadingDb, ReadingRow,
} from '../services/readings.service';
import {
  fetchStudyNotes, addStudyNote as addNoteDb, updateStudyNote as updateNoteDb,
  deleteStudyNote as deleteNoteDb, StudyNoteRow,
} from '../services/studyNotes.service';

/** DB → 프론트: Reading */
function toReadingItem(row: ReadingRow): ReadingItem {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    totalPages: row.total_pages,
    currentPage: row.current_page,
    totalLessons: row.total_lessons,
    currentLesson: row.current_lesson,
    status: row.status as ReadingItem['status'],
    coverEmoji: row.cover_emoji ?? '',
    coverImage: row.cover_image,
    startDate: row.start_date,
    completedDate: row.completed_date,
    rating: row.rating,
    review: row.review,
    tags: row.tags,
    link: row.link,
    price: row.price,
    toc: row.toc,
    chapters: row.chapters,
    isbn13: row.isbn13,
  };
}

/** DB → 프론트: StudyNote */
function toStudyNote(row: StudyNoteRow): StudyNote {
  return {
    id: row.id,
    readingId: row.reading_id,
    date: row.date,
    time: row.time,
    chapter: row.chapter,
    content: (row.content ?? {}) as Record<string, unknown>,
    rawText: row.raw_text,
    sections: row.sections as NoteSection[] | undefined,
    actionItems: row.action_items_json as NoteActionItem[] | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 프론트 → DB: Reading */
function toReadingDbFields(patch: Partial<ReadingItem>): Partial<ReadingRow> {
  const db: Partial<ReadingRow> = {};
  if (patch.title !== undefined) db.title = patch.title;
  if (patch.author !== undefined) db.author = patch.author;
  if (patch.category !== undefined) db.category = patch.category;
  if (patch.totalPages !== undefined) db.total_pages = patch.totalPages;
  if (patch.currentPage !== undefined) db.current_page = patch.currentPage;
  if (patch.totalLessons !== undefined) db.total_lessons = patch.totalLessons;
  if (patch.currentLesson !== undefined) db.current_lesson = patch.currentLesson;
  if (patch.status !== undefined) db.status = patch.status;
  if (patch.coverEmoji !== undefined) db.cover_emoji = patch.coverEmoji;
  if (patch.coverImage !== undefined) db.cover_image = patch.coverImage;
  if (patch.startDate !== undefined) db.start_date = patch.startDate;
  if (patch.completedDate !== undefined) db.completed_date = patch.completedDate;
  if (patch.rating !== undefined) db.rating = patch.rating;
  if (patch.review !== undefined) db.review = patch.review;
  if (patch.tags !== undefined) db.tags = patch.tags;
  if (patch.link !== undefined) db.link = patch.link;
  if (patch.price !== undefined) db.price = patch.price;
  if (patch.toc !== undefined) db.toc = patch.toc;
  if (patch.chapters !== undefined) db.chapters = patch.chapters;
  if (patch.isbn13 !== undefined) db.isbn13 = patch.isbn13;
  return db;
}

/** 프론트 → DB: StudyNote */
function toNoteDbFields(patch: Partial<StudyNote>): Partial<StudyNoteRow> {
  const db: Partial<StudyNoteRow> = {};
  if (patch.readingId !== undefined) db.reading_id = patch.readingId;
  if (patch.date !== undefined) db.date = patch.date;
  if (patch.time !== undefined) db.time = patch.time;
  if (patch.chapter !== undefined) db.chapter = patch.chapter;
  if (patch.content !== undefined) db.content = patch.content;
  if (patch.rawText !== undefined) db.raw_text = patch.rawText;
  if (patch.sections !== undefined) db.sections = patch.sections as unknown[];
  if (patch.actionItems !== undefined) db.action_items_json = patch.actionItems as unknown[];
  return db;
}

export function useReadings() {
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [readingRows, noteRows] = await Promise.all([fetchReadings(), fetchStudyNotes()]);
      setReadings(readingRows.map(toReadingItem));
      setStudyNotes(noteRows.map(toStudyNote));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useReadings] Supabase 연결 실패, 더미 데이터 사용:', e);
      setReadings(dummyReadings);
      setStudyNotes(dummyStudyNotes);
      setUsingDummy(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Reading CRUD ──

  const addReading = useCallback(async (data: Omit<ReadingItem, 'id'>) => {
    if (usingDummy) {
      const newItem: ReadingItem = { ...data, id: Date.now().toString() };
      setReadings((prev) => [newItem, ...prev]);
      return;
    }
    try {
      const dbData = toReadingDbFields(data) as Omit<ReadingRow, 'id' | 'created_at'>;
      const row = await addReadingDb(dbData);
      setReadings((prev) => [toReadingItem(row), ...prev]);
    } catch (e) {
      console.error('[useReadings] 독서 추가 실패:', e);
      throw e;
    }
  }, [usingDummy]);

  const updateReading = useCallback(async (id: string, patch: Partial<ReadingItem>) => {
    const prev = readings;
    setReadings((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    if (!usingDummy) {
      try {
        const dbPatch = toReadingDbFields(patch);
        if (Object.keys(dbPatch).length > 0) {
          await updateReadingDb(id, dbPatch);
        }
      } catch (e) {
        console.error('[useReadings] 독서 업데이트 실패:', e);
        setReadings(prev);
      }
    }
  }, [readings, usingDummy]);

  const removeReading = useCallback(async (id: string) => {
    setReadings((prev) => prev.filter((r) => r.id !== id));
    setStudyNotes((prev) => prev.filter((n) => n.readingId !== id));
    if (!usingDummy) {
      try {
        await deleteReadingDb(id);
      } catch (e) {
        console.error('[useReadings] 독서 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  // ── StudyNote CRUD ──

  const addNote = useCallback(async (data: Omit<StudyNote, 'id' | 'createdAt'>) => {
    if (usingDummy) {
      const newNote: StudyNote = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };
      setStudyNotes((prev) => [newNote, ...prev]);
      return;
    }
    try {
      const dbData = toNoteDbFields(data) as Omit<StudyNoteRow, 'id' | 'created_at'>;
      const row = await addNoteDb(dbData);
      setStudyNotes((prev) => [toStudyNote(row), ...prev]);
    } catch (e) {
      console.error('[useReadings] 노트 추가 실패:', e);
    }
  }, [usingDummy]);

  const updateNote = useCallback(async (id: string, patch: Partial<StudyNote>) => {
    const prev = studyNotes;
    setStudyNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));

    if (!usingDummy) {
      try {
        const dbPatch = toNoteDbFields(patch);
        if (Object.keys(dbPatch).length > 0) {
          await updateNoteDb(id, dbPatch);
        }
      } catch (e) {
        console.error('[useReadings] 노트 업데이트 실패:', e);
        setStudyNotes(prev);
      }
    }
  }, [studyNotes, usingDummy]);

  const removeNote = useCallback(async (id: string) => {
    setStudyNotes((prev) => prev.filter((n) => n.id !== id));
    if (!usingDummy) {
      try {
        await deleteNoteDb(id);
      } catch (e) {
        console.error('[useReadings] 노트 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  return {
    readings, setReadings, studyNotes, setStudyNotes, loading,
    addReading, updateReading, removeReading,
    addNote, updateNote, removeNote,
    reload: load,
  };
}
