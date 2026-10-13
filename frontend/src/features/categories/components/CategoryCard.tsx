import React from "react";
import { Link } from "react-router-dom";
import type { Category } from "@/types";

interface CategoryCardProps {
  category: Category;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category }) => {
  const { label, description, href, coverUrl, itemCount } = category;

  return (
    <Link
      to={href}
      className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-md"
    >
      {/* Cover image */}
      {coverUrl ? (
        <div className="aspect-4/3 overflow-hidden">
          <img
            src={coverUrl}
            alt={label}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="aspect-4/3 bg-muted/40" />
      )}

      {/* Text overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{label}</h3>
            {description && (
              <p className="mt-0.5 text-sm text-white/70 line-clamp-1">
                {description}
              </p>
            )}
          </div>
          {itemCount != null && (
            <span className="text-xs text-white/50 tabular-nums">
              {itemCount}
            </span>
          )}
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute right-4 top-4 text-white/0 transition-all duration-300 group-hover:text-white/80">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
          />
        </svg>
      </div>
    </Link>
  );
};
