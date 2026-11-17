import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, Icon, LoadingState, Screen, TextField } from '@/components/ui';
import { setPendingItems } from '@/lib/draftStore';
import { emptyItem } from '@/lib/nutrition/mealDraft';
import {
  draftFromProduct,
  isValidBarcode,
  lookupBarcode,
  nutritionFor,
  OffError,
  searchProducts,
  type OffProduct,
} from '@/lib/nutrition/openFoodFacts';
import { checkRange } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Mode = 'scan' | 'search';

export default function BarcodeLookup() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OffProduct[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [amount, setAmount] = useState('100');
  const handled = useRef(false);

  const lookup = async (c: string) => {
    setBusy(true);
    setError(null);
    setNotFound(null);
    try {
      const p = await lookupBarcode(c);
      setProduct(p);
      setAmount(p.servingGrams ? String(p.servingGrams) : '100');
      setScanning(false);
    } catch (e) {
      if (e instanceof OffError && e.kind === 'not_found') setNotFound(c);
      else setError(e instanceof Error ? e.message : 'Lookup failed.');
      setScanning(false);
    } finally {
      setBusy(false);
      handled.current = false;
    }
  };

  const onScanned = (r: BarcodeScanningResult) => {
    if (handled.current || !isValidBarcode(r.data)) return;
    handled.current = true;
    setCode(r.data);
    void lookup(r.data);
  };

  useEffect(() => {
    if (mode !== 'search') return;
    if (query.trim().length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      setBusy(true);
      setError(null);
      searchProducts(query)
        .then((r) => live && setResults(r))
        .catch((e) => live && setError(e instanceof Error ? e.message : 'Search failed.'))
        .finally(() => live && setBusy(false));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, mode]);

  const startScan = async () => {
    setError(null);
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        setError('Camera access was denied. Type the barcode digits instead, or allow camera access in your browser/device settings.');
        return;
      }
    }
    setScanning(true);
  };

  // ---------------------------------------------------------------- product detail
  if (product) {
    const grams = checkRange(amount, 1, 5000, 'Amount', true);
    const v = grams.value ? nutritionFor(product, grams.value) : null;
    const presets = [
      ...(product.servingGrams ? [{ value: String(product.servingGrams), label: `1 serving (${product.servingGrams} g)` }] : []),
      { value: '100', label: '100 g' },
      ...(product.servingGrams ? [{ value: String(product.servingGrams * 2), label: `2 servings` }] : [{ value: '50', label: '50 g' }]),
    ];
    return (
      <Screen narrow footer={
        <View style={styles.row}>
          <Button label="Back" variant="secondary" onPress={() => setProduct(null)} style={{ flex: 1 }} />
          <Button
            label="Review & save"
            disabled={!grams.value || !product.hasNutrition}
            onPress={() => {
              setPendingItems([draftFromProduct(product, grams.value!)]);
              router.replace('/log/manual');
            }}
            style={{ flex: 2 }}
          />
        </View>
      }>
        <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.sm }}>{product.name}</AppText>
        <AppText tone="muted">
          {[product.brand, product.packageQuantity, `Barcode ${product.code}`].filter(Boolean).join(' · ')}
        </AppText>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={[styles.productImg, { backgroundColor: colors.surface }]} resizeMode="contain" accessibilityLabel={product.name} /> : null}
        <Banner tone="info" title="From the product label">
          Nutrition comes from Open Food Facts, a community database of product labels. Check it against the pack if something looks off.
        </Banner>
        {!product.hasNutrition ? (
          <Banner tone="warning" title="No nutrition data">
            This product has no nutrition facts in the database yet. Add it manually using the label on the pack.
          </Banner>
        ) : (
          <>
            <ChoiceGroup label="How much?" options={presets} value={presets.find((p) => p.value === amount) ? amount : null} onChange={setAmount} />
            <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" suffix="g" error={grams.error} />
            {v ? (
              <Card tone="hero">
                <AppText variant="display" numeric>{v.calories ?? '—'} <AppText variant="heading" tone="muted">kcal</AppText></AppText>
                <AppText tone="muted" numeric>
                  Protein {v.protein ?? '—'} g · Carbs {v.carbs ?? '—'} g · Fat {v.fat ?? '—'} g
                </AppText>
                <AppText variant="caption" tone="subtle" numeric>
                  Fibre {v.fibre ?? '—'} g · Sugar {v.sugar ?? '—'} g · Sodium {v.sodium ?? '—'} mg
                </AppText>
              </Card>
            ) : null}
            {product.servingSize ? <AppText variant="caption" tone="subtle">Label serving size: {product.servingSize}</AppText> : null}
          </>
        )}
        {!product.hasNutrition ? (
          <Button
            label="Enter nutrition manually"
            onPress={() => {
              setPendingItems([emptyItem({ name: product.name, source: 'barcode', barcode: isValidBarcode(product.code) ? product.code : null })]);
              router.replace('/log/manual');
            }}
          />
        ) : null}
      </Screen>
    );
  }

  // ---------------------------------------------------------------- scan / search
  return (
    <Screen narrow>
      <View style={styles.top}>
        <Button label="Back" icon="chevron-back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <AppText variant="title" accessibilityRole="header">Packaged food</AppText>
      <ChoiceGroup<Mode>
        options={[{ value: 'scan', label: 'Barcode' }, { value: 'search', label: 'Search products' }]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setScanning(false);
          setError(null);
          setNotFound(null);
        }}
      />

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notFound ? (
        <Banner tone="warning" title="Product not found">
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="muted">Barcode {notFound} isn’t in Open Food Facts yet. You can add it manually from the label.</AppText>
            <Button
              label="Add manually"
              size="sm"
              variant="secondary"
              onPress={() => {
                setPendingItems([emptyItem({ source: 'barcode', barcode: notFound })]);
                router.replace('/log/manual');
              }}
            />
          </View>
        </Banner>
      ) : null}

      {mode === 'scan' ? (
        <>
          {scanning ? (
            <View style={[styles.cameraBox, { borderColor: colors.border }]}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                onBarcodeScanned={busy ? undefined : onScanned}
              />
              <View pointerEvents="none" style={[styles.reticle, { borderColor: colors.primary }]} />
              {busy ? <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.overlay }]}><LoadingState label="Looking up…" /></View> : null}
            </View>
          ) : (
            <Button label="Scan barcode with camera" icon="scan" size="lg" onPress={startScan} fullWidth />
          )}
          {scanning ? <Button label="Stop camera" variant="ghost" onPress={() => setScanning(false)} /> : null}
          <AppText variant="caption" tone="subtle" align="center">Camera scanning needs HTTPS and camera permission. Or type the digits under the barcode:</AppText>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="Barcode number" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={14} onSubmitEditing={() => isValidBarcode(code) && lookup(code)} />
            </View>
          </View>
          <Button label="Look up" variant="secondary" onPress={() => lookup(code)} disabled={!isValidBarcode(code)} loading={busy && !scanning} />
        </>
      ) : (
        <>
          <TextField label="Product name or brand" value={query} onChangeText={setQuery} placeholder="e.g. Parle-G, Amul butter" returnKeyType="search" autoCorrect={false} />
          {busy ? <LoadingState label="Searching…" /> : null}
          {results && query.trim().length >= 2 && !busy ? (
            results.length === 0 ? (
              <Card tone="inset"><AppText tone="muted" align="center">No products found. Try another name, or add it manually.</AppText></Card>
            ) : (
              <Card padded={false}>
                {results.map((p, i) => (
                  <Pressable
                    key={p.code}
                    onPress={() => {
                      setProduct(p);
                      setAmount(p.servingGrams ? String(p.servingGrams) : '100');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}${p.brand ? ` by ${p.brand}` : ''}`}
                    style={({ pressed }) => [styles.result, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfaceSunken }]}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>{p.name}</AppText>
                      <AppText variant="caption" tone="subtle" numberOfLines={1}>
                        {[p.brand, p.packageQuantity].filter(Boolean).join(' · ')}
                        {p.per100g.calories !== null ? ` · ${Math.round(p.per100g.calories)} kcal/100 g` : ' · no nutrition data'}
                      </AppText>
                    </View>
                    <Icon name="chevron-forward" size={16} color={colors.textSubtle} />
                  </Pressable>
                ))}
              </Card>
            )
          ) : null}
          <AppText variant="caption" tone="subtle">Product data © Open Food Facts contributors (ODbL).</AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', marginLeft: -spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  cameraBox: { width: '100%', aspectRatio: 3 / 4, maxHeight: 460, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1 },
  reticle: { position: 'absolute', left: '12%', right: '12%', top: '38%', height: '24%', borderWidth: 2, borderRadius: radius.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  productImg: { width: '100%', height: 180, borderRadius: radius.lg },
});
