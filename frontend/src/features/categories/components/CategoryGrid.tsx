import React from "react";
import type { Category } from "@/types";
import { CategoryCard } from "./CategoryCard";

interface CategoryGridProps {
  categories: Category[];
  columns?: 2 | 3 | 4;
}

const COL_CLASSES = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
} as const;

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  columns = 3,
}) => {
  return (
    <div className={`grid grid-cols-1 gap-4 ${COL_CLASSES[columns]}`}>
      {categories.map((cat) => (
        <CategoryCard key={cat.id} category={cat} />
      ))}
    </div>
  );
};
