import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface Props {
  id: string;
  children: React.ReactNode;
}

export default function SortableItem({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className={`sortable-card ${isDragging ? 'dragging' : ''}`}>
      <div className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        <GripVertical size={16} />
      </div>
      <div className="sortable-content" style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
