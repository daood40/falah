import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/l10n.dart';
import '../core/theme.dart';
import '../state/app_state.dart';
import 'common.dart';

/// يفتح نافذة إدارة التصنيفات. يرجع معرّف آخر تصنيف أُنشئ (إن وُجد)
/// حتى يتمكن محرر المهمة من اختياره مباشرة.
Future<String?> showCategoryManagerSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const CategoryManagerSheet(),
  );
}

class CategoryManagerSheet extends StatefulWidget {
  const CategoryManagerSheet({super.key});

  @override
  State<CategoryManagerSheet> createState() => _CategoryManagerSheetState();
}

class _CategoryManagerSheetState extends State<CategoryManagerSheet> {
  final _nameController = TextEditingController();
  String? _lastCreatedId;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _addCategory() {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;
    final state = context.read<AppState>();
    final color =
        kTaskColorPalette[state.categories.length % kTaskColorPalette.length];
    final created = state.addCategory(name, color);
    setState(() {
      _lastCreatedId = created.id;
      _nameController.clear();
    });
  }

  Future<void> _confirmDelete(String id) async {
    final state = context.read<AppState>();
    final s = AppStrings.of(state.lang);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(s.delete),
        content: Text(s.deleteCategoryConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(s.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: context.wq.missed),
            child: Text(s.delete),
          ),
        ],
      ),
    );
    if (confirmed == true) state.removeCategory(id);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(22, 12, 22, 22),
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: wq.none,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            s.categoriesManage,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 16),
          if (state.categories.isEmpty)
            EmptyHint(s.noData)
          else
            for (final category in state.categories)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Container(
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        color: Color(category.colorValue),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(category.name)),
                    WqIconButton(
                      tooltip: s.delete,
                      onTap: () => _confirmDelete(category.id),
                      child: Icon(
                        Icons.delete_outline,
                        size: 17,
                        color: wq.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
          const SizedBox(height: 8),
          Text(
            s.addCategory,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: wq.textMuted,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _nameController,
                  decoration: InputDecoration(hintText: s.categoryName),
                  onSubmitted: (_) => _addCategory(),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _addCategory,
                child: const Icon(Icons.add, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(_lastCreatedId),
            child: Text(s.close),
          ),
        ],
      ),
    );
  }
}
