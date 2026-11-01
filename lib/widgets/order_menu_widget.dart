import 'package:flutter/material.dart';
import '../config/ditto_config.dart';
import '../models/sky4all_models.dart';
import '../services/ditto_service.dart';
import '../services/i18n_service.dart';

class OrderMenuWidget extends StatefulWidget {
  final String seat;
  final String flightId;
  final String flightDate;
  final DittoService ditto;
  final I18nService i18n;
  final VoidCallback onBack;

  const OrderMenuWidget({
    super.key,
    required this.seat,
    required this.flightId,
    required this.flightDate,
    required this.ditto,
    required this.i18n,
    required this.onBack,
  });

  @override
  State<OrderMenuWidget> createState() => _OrderMenuWidgetState();
}

class _OrderMenuWidgetState extends State<OrderMenuWidget> {
  String _category = 'all';
  final Map<String, int> _cart = {};
  bool _sent = false;

  void _bump(String name, int delta) {
    setState(() {
      final current = _cart[name] ?? 0;
      final next = (current + delta).clamp(0, 99);
      if (next == 0) {
        _cart.remove(name);
      } else {
        _cart[name] = next;
      }
    });
  }

  int get _totalCount =>
      _cart.values.fold(0, (previous, qty) => previous + qty);

  int get _totalCents => cartTotalCents(_cart);

  void _sendOrder() {
    if (_totalCount == 0 || _sent) return;
    final orderItems = _cart.entries
        .where((e) => e.value > 0)
        .map((e) => OrderItem(name: e.key, qty: e.value))
        .toList();

    widget.ditto.insertOrder(
      seat: widget.seat,
      flightId: widget.flightId,
      flightDate: widget.flightDate,
      items: orderItems,
    );
    widget.ditto.insertRequest(
      type: RequestType.order,
      seat: widget.seat,
      flightId: widget.flightId,
      flightDate: widget.flightDate,
      payload: {'items': orderItems.map((e) => e.toMap()).toList()},
    );

    setState(() {
      _sent = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;
    final ro = widget.i18n.isRo;

    if (_sent) {
      final items = _cart.entries.where((e) => e.value > 0).toList();
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
        decoration: BoxDecoration(
          color: Sky4AllPalette.card,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                color: Sky4AllPalette.seatOk,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check,
                size: 28,
                color: Sky4AllPalette.seatOkForeground,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              t('orderSent'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Sky4AllPalette.foreground,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${t('yourSeat')} ${widget.seat} · $_totalCount ${ro ? 'produse' : 'items'}',
              style: const TextStyle(
                fontSize: 14,
                color: Sky4AllPalette.mutedForeground,
              ),
            ),
            const SizedBox(height: 16),
            ...items.map(
              (entry) => Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: Sky4AllPalette.border),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      entry.key,
                      style: const TextStyle(fontSize: 14),
                    ),
                    Text(
                      '×${entry.value}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.only(top: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                  Text(
                    formatPrice(_totalCents, ro),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: widget.onBack,
                icon: const Icon(Icons.arrow_back, size: 16),
                label: Text(t('back')),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Sky4AllPalette.primary,
                  foregroundColor: Sky4AllPalette.primaryForeground,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final filtered = kMenuProducts
        .where((p) => _category == 'all' || p.category == _category)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton.icon(
              onPressed: widget.onBack,
              icon: const Icon(Icons.arrow_back, size: 16),
              label: Text(t('back')),
              style: TextButton.styleFrom(
                foregroundColor: Sky4AllPalette.primary,
                padding: EdgeInsets.zero,
              ),
            ),
            RichText(
              text: TextSpan(
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Sky4AllPalette.mutedForeground,
                ),
                children: [
                  TextSpan(text: '${t('yourSeat')} '),
                  TextSpan(
                    text: widget.seat,
                    style: const TextStyle(
                      color: Sky4AllPalette.foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'SKY4ALL · ${ro ? 'MENIU LA BORD' : 'ONBOARD MENU'}',
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: Sky4AllPalette.mutedForeground,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          ro ? 'Gustări și băuturi' : 'Snacks & drinks',
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: Sky4AllPalette.foreground,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          ro
              ? '40 de produse · Prețuri demonstrative în EUR'
              : '40 products · Demo prices in EUR',
          style: const TextStyle(
            fontSize: 12,
            color: Sky4AllPalette.mutedForeground,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: Sky4AllPalette.secondary.withOpacity(0.6),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              _buildCategoryTab(
                id: 'all',
                label: ro ? 'Toate' : 'All',
                icon: Icons.shopping_bag_outlined,
              ),
              const SizedBox(width: 4),
              _buildCategoryTab(
                id: 'drinks',
                label: ro ? 'Băuturi' : 'Drinks',
                icon: Icons.local_drink_outlined,
              ),
              const SizedBox(width: 4),
              _buildCategoryTab(
                id: 'snacks',
                label: ro ? 'Gustări' : 'Snacks',
                icon: Icons.cookie_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: filtered.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.64,
          ),
          itemBuilder: (context, index) {
            final product = filtered[index];
            final qty = _cart[product.name] ?? 0;
            return Container(
              decoration: BoxDecoration(
                color: Sky4AllPalette.card,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Sky4AllPalette.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: Container(
                      color: Colors.white,
                      padding: const EdgeInsets.all(8),
                      child: Image.asset(
                        product.imageAsset,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Center(
                          child: Icon(
                            Icons.fastfood,
                            size: 40,
                            color: Sky4AllPalette.primary,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          height: 36,
                          child: Text(
                            product.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Sky4AllPalette.foreground,
                            ),
                          ),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              product.detail,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Sky4AllPalette.mutedForeground,
                              ),
                            ),
                            Text(
                              formatPrice(product.priceCents, ro),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Sky4AllPalette.primary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.only(top: 8),
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: Sky4AllPalette.border),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _qtyButton(
                                icon: Icons.remove,
                                enabled: qty > 0,
                                primary: false,
                                onTap: () => _bump(product.name, -1),
                              ),
                              Text(
                                '$qty',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              _qtyButton(
                                icon: Icons.add,
                                enabled: true,
                                primary: true,
                                onTap: () => _bump(product.name, 1),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.only(top: 10),
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: Sky4AllPalette.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    ro ? 'Total comandă' : 'Order total',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    formatPrice(_totalCents, ro),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: _totalCount > 0 ? _sendOrder : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Sky4AllPalette.primary,
                  foregroundColor: Sky4AllPalette.primaryForeground,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.shopping_bag_outlined, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          t('sendOrder'),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color:
                            Sky4AllPalette.primaryForeground.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '$_totalCount',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryTab({
    required String id,
    required String label,
    required IconData icon,
  }) {
    final selected = _category == id;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _category = id),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? Sky4AllPalette.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: selected
                    ? Sky4AllPalette.primaryForeground
                    : Sky4AllPalette.foreground,
              ),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? Sky4AllPalette.primaryForeground
                      : Sky4AllPalette.foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _qtyButton({
    required IconData icon,
    required bool enabled,
    required bool primary,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(8),
      child: Opacity(
        opacity: enabled ? 1.0 : 0.4,
        child: Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: primary ? Sky4AllPalette.primary : Sky4AllPalette.secondary,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            icon,
            size: 16,
            color: primary
                ? Sky4AllPalette.primaryForeground
                : Sky4AllPalette.secondaryForeground,
          ),
        ),
      ),
    );
  }
}
