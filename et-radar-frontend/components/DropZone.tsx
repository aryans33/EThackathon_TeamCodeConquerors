/* eslint-disable */
"use client"
import React, { useState, useRef } from "react"
import { Upload } from "lucide-react"

interface DropZoneProps {
  onFileSelect: (file: File) => void
}

export default function DropZone({ onFileSelect }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type === "application/pdf") {
        setSelectedFile(file)
        onFileSelect(file)
      } else {
        alert("Please upload a PDF file")
      }
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setSelectedFile(file)
      onFileSelect(file)
    }
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        isDragging ? "border-brand-green bg-brand-green/5" : "border-brand-border hover:border-slate-500"
      }`}
    >
      <input
        type="file"
        accept=".pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center justify-center pointer-events-none">
        <Upload className="w-10 h-10 text-slate-500 mb-4" />
        {selectedFile ? (
          <div>
            <div className="text-brand-text font-medium mb-1">{selectedFile.name}</div>
            <div className="text-xs text-brand-muted">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
        ) : (
          <>
            <div className="text-brand-muted font-medium mb-1">Drop your PDF here</div>
            <div className="text-xs text-slate-500">CAMS or KFintech statement &middot; PDF only &middot; Max 10MB</div>
          </>
        )}
      </div>
    </div>
  )
}
