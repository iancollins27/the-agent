
import React from 'react';
import { Star } from "lucide-react";

type PromptRunRatingProps = {
  rating: number | null;
  onRatingChange?: (rating: number) => void;
  size?: 'sm' | 'md';
};

const PromptRunRating: React.FC<PromptRunRatingProps> = ({ 
  rating, 
  onRatingChange,
  size = 'sm'
}) => {
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${onRatingChange ? 'cursor-pointer' : ''} ${
            (rating || 0) >= star
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
          onClick={() => onRatingChange && onRatingChange(star)}
        />
      ))}
    </div>
  );
};

export default PromptRunRating;
