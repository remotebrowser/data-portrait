import { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { EmptyState } from '../components/EmptyState.js';
import { PurchaseDataDisplay } from '../components/PurchaseDataDisplay.js';
import { GeneratedImagesGrid } from '../components/GeneratedImagesGrid.js';
import { ImagePreviewModal } from '../components/ImagePreviewModal.js';
import { StoryPreviewModal } from '../components/StoryPreviewModal.js';
import { SignInDialog } from '../components/SignInDialog.js';
import { Sidebar } from '../components/Sidebar.js';
import amazon from '../config/amazon.json' with { type: 'json' };
import wayfair from '../config/wayfair.json' with { type: 'json' };
import officedepot from '../config/officedepot.json' with { type: 'json' };
import goodreads from '../config/goodreads.json' with { type: 'json' };
import gofood from '../config/gofood.json' with { type: 'json' };
import garmin from '../config/garmin.json' with { type: 'json' };
import tokopedia from '../config/tokopedia.json' with { type: 'json' };
import shopee from '../config/shopee.json' with { type: 'json' };
import type { BrandConfig } from '../modules/Config.js';
import { type PurchaseHistory } from '../modules/DataTransformSchema.js';
import type {
  GeneratedImage,
  ImageFormat,
} from '../modules/PortraitGeneration.js';
import { generatePortrait as generatePortraitModule } from '../modules/PortraitGeneration.js';
import { filterUniqueOrders } from '../utils/index.js';
import { getRandomGender } from '../modules/Gender.js';
import { getRandomStyle } from '../modules/ImageStyle.js';
import { log } from '../utils/log.js';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { useAppConfig } from '../hooks/useAppConfig.js';

const amazonConfig = amazon as BrandConfig;
const wayfairConfig = wayfair as BrandConfig;
const officedepotConfig = officedepot as BrandConfig;
const goodreadsConfig = goodreads as BrandConfig;
const gofoodConfig = gofood as BrandConfig;
const garminConfig = garmin as BrandConfig;
const tokopediaConfig = tokopedia as BrandConfig;
const shopeeConfig = shopee as BrandConfig;
const BRANDS: Array<BrandConfig> = [
  amazonConfig,
  officedepotConfig,
  wayfairConfig,
  goodreadsConfig,
  gofoodConfig,
  garminConfig,
  tokopediaConfig,
  shopeeConfig,
];

const EXCLUDED_BRANDS: Array<string> = [
  // NOTE: exclude officedepot for now until successfully migrated to dpage
  officedepotConfig.brand_id,
];

const EXCLUDED_BRAND_FROM_UNIQUE_FILTER: Array<string> = [
  garminConfig.brand_name,
];

// Sample data for demo purposes
const sampleOrders: PurchaseHistory[] = [
  {
    order_id: 'demo-001',
    brand: 'Amazon',
    order_date: new Date('2024-01-15'),
    order_total: '$89.97',
    product_names: [
      'Wireless Bluetooth Headphones',
      'Coffee Mug Set (4-pack)',
      'Desk Organizer with Drawers',
    ],
    image_urls: ['/headphone.jpg', '/mug.jpg', '/organizer.jpg'],
  },
  {
    order_id: 'demo-003',
    brand: 'Goodreads',
    order_date: new Date('2024-01-08'),
    order_total: '$0.00',
    product_names: [
      'The Midnight Library',
      'Atomic Habits',
      'Project Hail Mary',
    ],
    image_urls: [
      '/midnight-library.jpg',
      '/atomic-habits.jpg',
      '/project-hail-mary.jpg',
    ],
  },
  {
    order_id: 'demo-004',
    brand: 'GoFood',
    order_date: new Date('2024-01-20'),
    order_total: 'Rp 125,000',
    product_names: [
      'Nasi Goreng Special',
      'Ayam Bakar Madu',
      'Es Teh Manis',
      'Pisang Goreng',
    ],
    image_urls: [
      '/nasi-goreng.jpg',
      '/ayam-bakar.jpg',
      '/es-teh.jpg',
      '/pisang-goreng.jpg',
    ],
  },
];

export function DataPortrait() {
  const { trackEvent } = useAnalytics();
  const { config: appConfig } = useAppConfig();

  const [orders, setOrders] = useState<PurchaseHistory[]>([]);
  const [connectedBrands, setConnectedBrands] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState(getRandomGender());
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedImageStyle, setSelectedImageStyle] = useState<string[]>([
    getRandomStyle(),
  ]);
  const [imageFormat, setImageFormat] = useState<ImageFormat>('single');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<GeneratedImage | null>(
    null
  );
  const [signInDialogBrand, setSignInDialogBrand] =
    useState<BrandConfig | null>(null);

  // Track page view on component mount
  useEffect(() => {
    trackEvent('page_view', {
      page: 'data_portrait',
    });
  }, [trackEvent]);

  const handleSuccessConnect = (brandName: string, data: PurchaseHistory[]) => {
    log({
      message: 'Received orders from client',
      data: { brandName, data },
      type: 'server',
    });

    trackEvent('brand_connected_successful', {
      brand_name: brandName,
      orders_count: data.length,
      connected_brands_count: connectedBrands.length,
      connected_brands: connectedBrands,
      data: data,
    });

    setConnectedBrands((prev) => [...prev, brandName]);

    const shouldSkipUniqueFilter =
      EXCLUDED_BRAND_FROM_UNIQUE_FILTER.includes(brandName);

    setOrders((prev) => {
      const combined = [...prev, ...data];
      return shouldSkipUniqueFilter ? combined : filterUniqueOrders(combined);
    });

    // Select all items from the new data by default
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);
      data.forEach((order) => {
        order.product_names.forEach((productName) => {
          newSelected.add(`${order.order_id}__${productName}`);
        });
      });
      return newSelected;
    });
  };

  const handleOpenSignInDialog = (brandConfig: BrandConfig) => {
    setSignInDialogBrand(brandConfig);
  };

  const handleSignInSuccess = (data: PurchaseHistory[]) => {
    if (signInDialogBrand) {
      handleSuccessConnect(signInDialogBrand.brand_name, data);
    }
  };
  const toggleOrderExpansion = (orderId: string, productName: string) => {
    const newExpanded = new Set(expandedOrders);
    const key = `${orderId}__${productName}`;
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedOrders(newExpanded);
  };

  const toggleItemSelection = (orderId: string, productName: string) => {
    const newSelected = new Set(selectedItems);
    const key = `${orderId}__${productName}`;
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  const toggleBrandSelection = (brand: string, selectAll: boolean) => {
    const newSelected = new Set(selectedItems);
    const brandOrders = orders.filter((order) => order.brand === brand);

    brandOrders.forEach((order) => {
      order.product_names.forEach((productName) => {
        const key = `${order.order_id}__${productName}`;
        if (selectAll) {
          newSelected.add(key);
        } else {
          newSelected.delete(key);
        }
      });
    });

    setSelectedItems(newSelected);
  };

  const getFilteredOrdersForGeneration = useCallback((): PurchaseHistory[] => {
    return orders
      .map((order) => {
        const selectedProductIndices = order.product_names
          .map((productName, index) =>
            selectedItems.has(`${order.order_id}__${productName}`) ? index : -1
          )
          .filter((index) => index !== -1);

        if (selectedProductIndices.length === 0) {
          return null;
        }

        return {
          ...order,
          product_names: selectedProductIndices.map(
            (i) => order.product_names[i]
          ),
          image_urls: selectedProductIndices.map((i) => order.image_urls[i]),
        };
      })
      .filter((order): order is PurchaseHistory => order !== null);
  }, [orders, selectedItems]);

  const selectedItemsCount = useMemo(() => {
    const filteredOrders = getFilteredOrdersForGeneration();
    return filteredOrders.reduce(
      (total, order) => total + order.product_names.length,
      0
    );
  }, [getFilteredOrdersForGeneration]);

  const loadSampleData = () => {
    setOrders(sampleOrders);
    setConnectedBrands(['Amazon', 'Goodreads']);

    // Select all sample items by default
    const newSelected = new Set<string>();
    sampleOrders.forEach((order) => {
      order.product_names.forEach((productName) => {
        newSelected.add(`${order.order_id}__${productName}`);
      });
    });
    setSelectedItems(newSelected);
  };

  const clearData = () => {
    trackEvent('data_cleared', {
      orders_count: orders.length,
      connected_brands_count: connectedBrands.length,
    });
    setOrders([]);
    setConnectedBrands([]);
    setExpandedOrders(new Set());
    setSelectedItems(new Set());
  };

  const generatePortrait = async () => {
    const filteredOrders = getFilteredOrdersForGeneration();

    if (selectedItemsCount === 0) {
      alert('Please select at least one item to generate a portrait.');
      return;
    }

    trackEvent('portrait_generation_started', {
      orders_count: orders.length,
      selected_items_count: selectedItemsCount,
      connected_brands: connectedBrands,
      selected_gender: selectedGender,
      selected_traits: selectedTraits,
      selected_image_style: selectedImageStyle,
      image_format: imageFormat,
      has_uploaded_image: !!uploadedImage,
    });

    setIsGenerating(true);

    try {
      const generatedImage = await generatePortraitModule(imageFormat, {
        imageStyle: selectedImageStyle,
        gender: selectedGender,
        traits: selectedTraits,
        purchaseData: filteredOrders,
        uploadedImage,
      });

      setGeneratedImages((prev) => [
        generatedImage,
        ...prev.slice(0, 11), // Keep only the latest 12 images
      ]);

      const firstImage = generatedImage.images[0];
      trackEvent('portrait_generation_successful', {
        model: firstImage?.model || 'gemini',
        provider: firstImage?.provider || 'unknown',
        image_style: selectedImageStyle,
        image_format: imageFormat,
        orders_count: orders.length,
        selected_items_count: selectedItemsCount,
        used_uploaded_image: !!uploadedImage,
      });

      // Close sidebar on mobile after successful generation
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    } catch (error: unknown) {
      trackEvent('portrait_generation_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orders_count: orders.length,
        selected_items_count: selectedItemsCount,
        selected_image_style: selectedImageStyle,
        image_format: imageFormat,
        used_uploaded_image: !!uploadedImage,
      });
      alert('Failed to generate portrait. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* Mobile Header with Hamburger Menu - Only visible on small screens */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        {/* Top Header Bar */}
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Data Portrait</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2"
            >
              {isSidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area (Left) - Independent scroll */}
      <div className="flex-1 flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-16 lg:pt-4">
          {/* Empty State - Show when no data is connected */}
          {connectedBrands.length === 0 && (
            <EmptyState
              onLoadSampleData={loadSampleData}
              onOpenSidebar={() => setIsSidebarOpen(true)}
            />
          )}

          {/* Purchase Data Display */}
          <PurchaseDataDisplay
            orders={orders}
            connectedBrands={connectedBrands}
            expandedOrders={expandedOrders}
            selectedItems={selectedItems}
            onToggleOrderExpansion={toggleOrderExpansion}
            onToggleItemSelection={toggleItemSelection}
            onToggleBrandSelection={toggleBrandSelection}
            onClearData={clearData}
          />

          {/* Generated Images Grid - Only show if we have connected brands */}
          {connectedBrands.length > 0 && (
            <GeneratedImagesGrid
              generatedImages={generatedImages}
              isGenerating={isGenerating}
              selectedImageStyle={selectedImageStyle}
              onPreviewClick={setSelectedPreview}
            />
          )}
        </div>
      </div>

      {/* Floating Action Button - Bottom */}
      {connectedBrands.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30 lg:hidden">
          <Button
            onClick={generatePortrait}
            disabled={isGenerating || selectedItemsCount === 0}
            size="lg"
            className="px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <span className="text-lg">✨</span>
            {isGenerating ? 'Generating...' : 'Generate Data Portrait'}
          </Button>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        brands={BRANDS.filter(
          (brand) => !EXCLUDED_BRANDS.includes(brand.brand_id)
        )}
        connectedBrands={connectedBrands}
        selectedGender={selectedGender}
        selectedTraits={selectedTraits}
        selectedImageStyle={selectedImageStyle}
        imageFormat={imageFormat}
        isGenerating={isGenerating}
        selectedItemsCount={selectedItemsCount}
        onSuccessConnect={handleSuccessConnect}
        onOpenSignInDialog={handleOpenSignInDialog}
        onGenderChange={setSelectedGender}
        onTraitsChange={setSelectedTraits}
        onImageStyleChange={setSelectedImageStyle}
        onImageFormatChange={setImageFormat}
        onGeneratePortrait={generatePortrait}
        onImageChange={setUploadedImage}
        enableImageUpload={appConfig.allowFaceUpload}
      />

      {/* Sign In Dialog */}
      {signInDialogBrand && (
        <SignInDialog
          isOpen={true}
          onClose={() => setSignInDialogBrand(null)}
          onSuccessSignin={handleSignInSuccess}
          brandConfig={signInDialogBrand}
        />
      )}

      {selectedPreview?.format === 'stories' ? (
        <StoryPreviewModal
          story={selectedPreview}
          onClose={() => setSelectedPreview(null)}
        />
      ) : selectedPreview ? (
        <ImagePreviewModal
          imageUrl={selectedPreview.images[0]?.url || null}
          onClose={() => setSelectedPreview(null)}
        />
      ) : null}
    </div>
  );
}
