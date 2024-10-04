"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function ColorPicker({ setColor }: { setColor: (color: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState("");
  const [customColor, setCustomColor] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const presetColors = [
    { code: "#ea580c", value: "" },
    { code: "#000000", value: "000" },
    { code: "#472B82", value: "472B82" },
    { code: "#7c65c1", value: "7c65c1" },
  ];

  const handleColorSelect = (color: string, value: string) => {
    setSelectedColor(color);
    setColor(value);
    setIsOpen(false);
  };

  const handleCustomColorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customColor) {
      setSelectedColor(customColor);
      setColor(customColor.replace("#", ""));
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="inline-block relative" ref={dropdownRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="secondary"
        className="flex items-center whitespace-nowrap min-w-[250px]"
        ref={buttonRef}
      >
        <span className="mr-2">{selectedColor || "Select Frame Background"}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
          style={{ width: buttonRef.current ? buttonRef.current.offsetWidth : "auto" }}
        >
          <div className="py-1">
            {presetColors.map((color) => (
              <button
                key={color.code}
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => handleColorSelect(color.code, color.value)}
              >
                <div
                  className="mr-3 h-6 w-6 rounded-full border border-gray-300"
                  style={{ backgroundColor: color.code }}
                />
                <span className="whitespace-nowrap">
                  {color.code}
                  {`${color.code === "#ea580c" ? " (default) " : ""}`}
                </span>
              </button>
            ))}
            <form onSubmit={handleCustomColorSubmit} className="px-4 py-2">
              <Input
                type="text"
                placeholder="Custom color (e.g. #15803d)"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="mb-2"
              />
              <Button type="submit" className="w-full">
                Confirm
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
