import { Facebook, Instagram, Linkedin, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

type SocialShareButtonsProps = {
  url: string;
  title?: string;
};

interface SharePlatform {
  name: string;
  icon: React.ReactNode;
  share: (url: string, title?: string) => void;
}

const platforms: SharePlatform[] = [
  {
    name: 'x',
    icon: <X className="w-4 h-4" />,
    share: (url: string, title?: string) => {
      const text = encodeURIComponent(
        `${title || 'Check out this generated data portrait!'}\n`
      );
      const xUrl = `https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`;
      window.open(xUrl, '_blank', 'width=550,height=420');
    },
  },
  {
    name: 'facebook',
    icon: <Facebook className="w-4 h-4" />,
    share: (url: string) => {
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      window.open(facebookUrl, '_blank', 'width=550,height=420');
    },
  },
  {
    name: 'linkedin',
    icon: <Linkedin className="w-4 h-4" />,
    share: (url: string) => {
      const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      window.open(linkedinUrl, '_blank', 'width=550,height=420');
    },
  },
  {
    name: 'whatsapp',
    icon: <MessageCircle className="w-4 h-4" />,
    share: (url: string, title?: string) => {
      const text = encodeURIComponent(
        `${title || 'Check out this generated data portrait!'} ${url}`
      );
      const whatsappUrl = `https://wa.me/?text=${text}`;
      window.open(whatsappUrl, '_blank');
    },
  },
  {
    name: 'instagram',
    icon: <Instagram className="w-4 h-4" />,
    share: () => {
      alert(
        'To share on Instagram, save the image and upload it through the Instagram app.'
      );
    },
  },
];

export function SocialShareButtons({
  url,
  title = 'Generated Data Portrait',
}: SocialShareButtonsProps) {
  const handleShare = (platform: SharePlatform) => {
    try {
      if (navigator.share && platform.name !== 'instagram') {
        navigator.share({
          title,
          text: 'Check out this generated data portrait!',
          url,
        });
      } else {
        platform.share(url, title);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error(`Error sharing to ${platform.name}:`, error);
      }
    }
  };

  return (
    <div className="flex gap-2">
      {platforms.map((platform) => (
        <Button
          key={platform.name}
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleShare(platform);
          }}
          className="bg-black bg-opacity-50 text-white hover:bg-opacity-70 rounded-full p-2"
          title={`Share on ${platform.name}`}
        >
          {platform.icon}
        </Button>
      ))}
    </div>
  );
}
