'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { EditableNoteView } from '@/components/notes/EditableNoteView'
import { NotesList } from '@/components/notes/NotesList'
import { FlashcardViewer } from '@/components/flashcards/FlashcardViewer'
import { NotesGraph } from '@/components/graph/NotesGraph'
import { NoteTemplates } from '@/components/notes/NoteTemplates'
import { KeyboardShortcuts } from '@/components/notes/KeyboardShortcuts'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type Note, type User, type NoteCollection, type SmartStudyQueue, type WeeklyDigestPreview, type ReminderPreviewItem, APIError } from '@/lib/api'
import { Plus, FileText, Network, Search, FolderOpen, PanelLeftClose, PanelLeftOpen, LayoutTemplate, HelpCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'

type View = 'notes' | 'flashcards' | 'graph'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [currentView, setCurrentView] = useState<View>('notes')
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotesPanel, setShowNotesPanel] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [collections, setCollections] = useState<NoteCollection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('')
  const [newCollectionName, setNewCollectionName] = useState('')
  const [smartQueue, setSmartQueue] = useState<SmartStudyQueue | null>(null)
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyDigestPreview | null>(null)
  const [reminders, setReminders] = useState<ReminderPreviewItem[]>([])
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(25 * 60)
  const [examLaunchToken, setExamLaunchToken] = useState(0)

  useEffect(() => {
    // Check for existing auth
    const token = localStorage.getItem('authToken')
    const userData = localStorage.getItem('user')

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        api.setToken(token)
        loadNotes()
        loadCollections()
      } catch (err) {
        // Invalid stored data, clear it
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
      }
    } else {
      if (typeof window !== 'undefined') {
        window.location.replace('/landing')
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    const timeout = setTimeout(() => {
      loadNotes(searchQuery, selectedCollectionId)
    }, 250)
    return () => clearTimeout(timeout)
  }, [searchQuery, selectedCollectionId, user])

  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setTimerRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Focus search input
        const searchInput = document.querySelector('input[placeholder="Search notes..."]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
      // Cmd/Ctrl + N for new note
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleCreateNote()
      }
      // Cmd/Ctrl + T for templates
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        setShowTemplates(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadNotes = async (query?: string, collectionId?: string) => {
    try {
      const hasFilters = Boolean((query && query.trim()) || collectionId)
      const response = hasFilters
        ? await api.searchNotes(query, collectionId || undefined)
        : await api.getNotes()
      setNotes(response.notes)
    } catch (err: unknown) {
      console.error('Failed to load notes:', err)
      // If it's an auth error, clear the token and redirect to login
      if (err instanceof APIError && (err.status === 401 || err.message?.includes('credentials'))) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
        setUser(null)
        setNotes([])
      }
    }
  }

  const loadCollections = async () => {
    try {
      const response = await api.getCollections()
      setCollections(response)
    } catch (error) {
      console.error('Failed to load collections:', error)
    }
  }

  const handleLogout = () => {
    api.clearToken()
    setUser(null)
    setNotes([])
    setSelectedNote(null)
    if (typeof window !== 'undefined') {
      window.location.replace('/landing')
    }
  }

  const handleCreateNote = () => {
    setSelectedNote(null)
  }

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim()
    if (!name) return
    try {
      const created = await api.createCollection(name)
      setCollections(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewCollectionName('')
      setSelectedCollectionId(created.id)
    } catch (error) {
      console.error('Failed to create collection:', error)
    }
  }

  const loadSmartQueue = async () => {
    try {
      const queue = await api.getSmartStudyQueue(20, 5)
      setSmartQueue(queue)
    } catch (error) {
      console.error('Failed to load smart queue:', error)
    }
  }

  const loadWeeklyDigest = async () => {
    try {
      const [digest, reminderData] = await Promise.all([
        api.getWeeklyDigestPreview(7),
        api.getReminderPreview(),
      ])
      setWeeklyDigest(digest)
      setReminders(reminderData)
    } catch (error) {
      console.error('Failed to load weekly digest:', error)
    }
  }

  const startExamSession = async () => {
    if (!selectedNote && notes.length > 0) {
      setSelectedNote(notes[0])
    }
    setCurrentView('flashcards')
    setExamLaunchToken(prev => prev + 1)
  }

  const toggleTimer = () => {
    if (timerSeconds === 0) {
      setTimerSeconds(25 * 60)
      setTimerRunning(true)
      return
    }
    setTimerRunning(prev => !prev)
  }

  const resetTimer = () => {
    setTimerRunning(false)
    setTimerSeconds(25 * 60)
  }

  const handleSelectTemplate = async (template: any) => {
    setShowTemplates(false)
    try {
      // Create a new note with template content via API
      const newNote = await api.createNote(template.name, template.content)
      console.log('Created note from template:', newNote)
      setSelectedNote(newNote)
      // Add the new note to the local state immediately
      setNotes(prevNotes => [newNote, ...prevNotes])
      // Also refresh the notes list to ensure consistency
      loadNotes()
    } catch (error) {
      console.error('Failed to create note from template:', error)
      // Fallback: create local note object
      const newNote = {
        id: '',
        title: template.name,
        content: template.content,
        summary: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: template.tags,
        user_id: user?.id || ''
      }
      setSelectedNote(newNote as Note)
    }
  }

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
  }

  const handleSaveNote = (note: Note) => {
    if (selectedNote) {
      // Update existing note
      setNotes(notes.map(n => (n.id === note.id ? note : n)))
    } else {
      // Add new note
      setNotes([note, ...notes])
    }
    setSelectedNote(note)
  }

  const handleAssignCollection = async (noteId: string, collectionId: string) => {
    try {
      const updated = await api.assignNoteToCollection(noteId, collectionId || null)
      setNotes(prev => prev.map(note => note.id === updated.id ? updated : note))
      if (selectedNote?.id === updated.id) {
        setSelectedNote(updated)
      }
      loadCollections()
    } catch (error) {
      console.error('Failed to assign collection:', error)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.deleteNote(noteId)
      setNotes(notes.filter(n => n.id !== noteId))
      if (selectedNote?.id === noteId) {
        setSelectedNote(null)
      }
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  const handleRefreshKeywords = async (noteId: string) => {
    try {
      const updatedNote = await api.extractKeywords(noteId)
      setNotes(notes.map(note => note.id === noteId ? updatedNote : note))
      if (selectedNote?.id === noteId) {
        setSelectedNote(updatedNote)
      }
    } catch (error) {
      console.error('Failed to extract keywords:', error)
      alert('Failed to extract keywords')
    }
  }

  const handleViewFlashcards = (note: Note) => {
    setSelectedNote(note)
    setCurrentView('flashcards')
  }

  const navigateToTitle = (title: string) => {
    const target = notes.find(n => n.title.toLowerCase() === title.toLowerCase())
    if (target) {
      setSelectedNote(target)
    }
  }

  const filteredNotes = notes

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading StudentsAI...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0f1115]">
      {/* Top Header */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-[#232a36] bg-white dark:bg-[#141820]">
        <Header user={user} onLogout={handleLogout} context="notes" />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - File Explorer */}
        {showNotesPanel && (
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col dark:bg-[#141820] dark:border-[#232a36]">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200 dark:border-[#232a36]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200 dark:bg-[#0f1115] dark:border-[#232a36] dark:text-gray-100"
                />
              </div>
              <div className="mt-3">
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm dark:bg-[#0f1115] dark:border-[#232a36] dark:text-gray-100"
                >
                  <option value="">All folders</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name} ({collection.note_count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* File Explorer Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#232a36]">
              <div className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Notes</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={loadSmartQueue}
                  variant="outline"
                  className="h-8 px-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                  title="Load Smart Queue"
                >
                  Queue
                </Button>
                <Button
                  size="sm"
                  onClick={loadWeeklyDigest}
                  variant="outline"
                  className="h-8 px-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                  title="Load weekly digest"
                >
                  Digest
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowTemplates(true)}
                  variant="outline"
                  className="h-8 px-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                  title="Use template"
                >
                  <LayoutTemplate className="h-4 w-4 mr-1" />
                  Template
                </Button>
              </div>
            </div>

            <div className="p-4 border-b border-gray-200 dark:border-[#232a36] space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New folder name"
                  className="h-8 bg-gray-50 border-gray-200 dark:bg-[#0f1115] dark:border-[#232a36] dark:text-gray-100"
                />
                <Button size="sm" onClick={handleCreateCollection} className="h-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {smartQueue && (
                <div className="rounded-md border border-gray-200 dark:border-[#232a36] p-2 text-xs text-gray-600 dark:text-gray-300">
                  <div>Due cards: {smartQueue.due_count} • Weak topics: {smartQueue.weak_count}</div>
                  {smartQueue.weak_notes.slice(0, 2).map((item) => (
                    <div key={item.note_id} className="mt-1 truncate">
                      • {item.title} ({item.avg_mastery}% mastery)
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-md border border-gray-200 dark:border-[#232a36] p-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="font-medium mb-1">Study Timer</div>
                <div className="mb-2 text-gray-900 dark:text-gray-100 text-sm">
                  {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={toggleTimer}>
                    {timerRunning ? 'Pause' : 'Start'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={resetTimer}>
                    Reset
                  </Button>
                </div>
              </div>
              {weeklyDigest && (
                <div className="rounded-md border border-gray-200 dark:border-[#232a36] p-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="font-medium mb-1">Weekly Digest</div>
                  <div>Notes created: {weeklyDigest.notes_created}</div>
                  <div>Flashcards reviewed: {weeklyDigest.flashcards_reviewed}</div>
                  <div>Due now: {weeklyDigest.due_flashcards}</div>
                </div>
              )}
              {reminders.length > 0 && (
                <div className="rounded-md border border-gray-200 dark:border-[#232a36] p-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="font-medium mb-1">Reminders</div>
                  <div className="space-y-1">
                    {reminders.slice(0, 4).map((item, idx) => (
                      <div key={`${item.type}-${idx}`} className="truncate">• {item.title}: {item.detail}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto">
              <NotesList
                notes={filteredNotes}
                onEdit={handleSelectNote}
                onDelete={handleDeleteNote}
                onSelect={handleSelectNote}
                onRefreshKeywords={handleRefreshKeywords}
                selectedNoteId={selectedNote?.id}
                onAssignCollection={handleAssignCollection}
                collections={collections}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top Toolbar */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 dark:bg-[#141820] dark:border-[#232a36]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Panel Toggle Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotesPanel(!showNotesPanel)}
                  className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                  title={showNotesPanel ? "Hide notes panel" : "Show notes panel"}
                >
                  {showNotesPanel ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
                <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as View)}>
                  <TabsList className="bg-gray-100 dark:bg-[#0f1115] dark:border dark:border-[#232a36]">
                    <TabsTrigger value="notes" className="flex items-center space-x-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white dark:data-[state=active]:bg-orange-600 dark:data-[state=active]:text-white">
                      <FileText className="h-4 w-4" />
                      <span>Notes</span>
                    </TabsTrigger>
                    <TabsTrigger value="flashcards" className="flex items-center space-x-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white dark:data-[state=active]:bg-orange-600 dark:data-[state=active]:text-white">
                      <img src="/flashcards-icon.svg" alt="Flashcards" className="h-4 w-4" />
                      <span>Flashcards</span>
                    </TabsTrigger>
                    <TabsTrigger value="graph" className="flex items-center space-x-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white dark:data-[state=active]:bg-orange-600 dark:data-[state=active]:text-white">
                      <Network className="h-4 w-4" />
                      <span>Graph</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startExamSession}
                  className="h-8 border-gray-300 dark:border-[#232a36]"
                >
                  Start Exam
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyboardShortcuts(true)}
                  className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Keyboard shortcuts (?)"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden min-h-0">
            {currentView === 'notes' ? (
              <EditableNoteView
                note={selectedNote}
                onSave={handleSaveNote}
                onNavigateByTitle={navigateToTitle}
                showNotesPanel={showNotesPanel}
                onToggleNotesPanel={() => setShowNotesPanel(!showNotesPanel)}
                onCreateNew={handleCreateNote}
              />
            ) : currentView === 'flashcards' ? (
              selectedNote || examLaunchToken > 0 ? (
                <FlashcardViewer
                  note={selectedNote}
                  onBack={() => setCurrentView('notes')}
                  autoStartExamToken={examLaunchToken}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#0f1115]">
                  <div className="text-center">
                    <img src="/icons/flashcards-icon.svg" alt="Flashcards" className="h-16 w-16 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No note selected</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Select a note to generate flashcards</p>
                  </div>
                </div>
              )
            ) : currentView === 'graph' ? (
              <NotesGraph
                notes={notes}
                onSelectNote={handleSelectNote}
                selectedNoteId={selectedNote?.id}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <NoteTemplates
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <KeyboardShortcuts
          isOpen={showKeyboardShortcuts}
          onClose={() => setShowKeyboardShortcuts(false)}
        />
      )}
    </div>
  )
}
