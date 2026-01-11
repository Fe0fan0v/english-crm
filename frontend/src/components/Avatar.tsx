import clsx from 'clsx';

interface AvatarProps {
  name: string;
  photo?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarColors = [
  'bg-green-200 text-green-700',
  'bg-yellow-200 text-yellow-700',
  'bg-pink-200 text-pink-700',
  'bg-purple-200 text-purple-700',
  'bg-blue-200 text-blue-700',
  'bg-orange-200 text-orange-700',
  'bg-teal-200 text-teal-700',
];

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export default function Avatar({ name, photo, size = 'md', className }: AvatarProps) {
  const getColorClass = (name: string) => {
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  const initials = name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={clsx(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold',
        sizeClasses[size],
        getColorClass(name),
        className
      )}
    >
      {initials || name.charAt(0).toUpperCase()}
    </div>
  );
}
