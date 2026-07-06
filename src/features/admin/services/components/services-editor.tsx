"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/features/booking/lib/money";
import type { Service, ServiceCategory } from "@/lib/supabase/types";
import {
    createCategory,
    deleteCategory,
    reorderCategories,
    updateCategory,
} from "../actions/categories";
import {
    createService,
    deleteService,
    reorderServices,
    updateService,
} from "../actions/services";
import { ApplyToAllModal } from "./apply-to-all-modal";

interface ServicesEditorProps {
    locationId: string;
    categories: ServiceCategory[];
    services: Service[];
    hasOtherLocations: boolean;
}

export function ServicesEditor({
    locationId,
    categories: initialCategories,
    services: initialServices,
    hasOtherLocations,
}: ServicesEditorProps) {
    const router = useRouter();
    const [categories, setCategories] = useState(initialCategories);
    const [services, setServices] = useState(initialServices);
    const [error, setError] = useState<string | null>(null);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [reordering, startReorderTransition] = useTransition();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const isCategoryDrag = categories.some((c) => c.id === active.id);
        if (isCategoryDrag) {
            const oldIndex = categories.findIndex((c) => c.id === active.id);
            const newIndex = categories.findIndex((c) => c.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return;
            const next = arrayMove(categories, oldIndex, newIndex);
            setCategories(next);
            startReorderTransition(async () => {
                const res = await reorderCategories({
                    locationId,
                    orderedIds: next.map((c) => c.id),
                });
                if (!res.ok) setError(res.error ?? "Failed to reorder categories");
            });
            return;
        }

        const activeService = services.find((s) => s.id === active.id);
        const overService = services.find((s) => s.id === over.id);
        if (!activeService || !overService) return;
        if (activeService.category_id !== overService.category_id) return;

        const categoryId = activeService.category_id;
        const inCategory = services
            .filter((s) => s.category_id === categoryId)
            .sort((a, b) => a.display_order - b.display_order);
        const oldIndex = inCategory.findIndex((s) => s.id === active.id);
        const newIndex = inCategory.findIndex((s) => s.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;

        const reordered = arrayMove(inCategory, oldIndex, newIndex).map(
            (s, idx) => ({ ...s, display_order: idx }),
        );
        const others = services.filter((s) => s.category_id !== categoryId);
        setServices([...others, ...reordered]);

        startReorderTransition(async () => {
            const res = await reorderServices({
                categoryId,
                orderedIds: reordered.map((s) => s.id),
            });
            if (!res.ok) setError(res.error ?? "Failed to reorder services");
        });
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
                {hasOtherLocations && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowApplyModal(true)}
                    >
                        Apply to all locations
                    </Button>
                )}
            </div>

            {error && (
                <div className="flex items-start justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    <p>{error}</p>
                    <button
                        type="button"
                        className="ml-3 text-red-700/70 hover:text-red-700"
                        onClick={() => setError(null)}
                    >
                        ✕
                    </button>
                </div>
            )}

            <DndContext
                id="services-dnd"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={categories.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-4">
                        {categories.length === 0 && (
                            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-muted">
                                No categories yet. Add one below to get started.
                            </p>
                        )}
                        {categories.map((category) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                services={services
                                    .filter((s) => s.category_id === category.id)
                                    .sort((a, b) => a.display_order - b.display_order)}
                                onError={setError}
                                onLocalCategoryUpdate={(updated) =>
                                    setCategories((prev) =>
                                        prev.map((c) => (c.id === updated.id ? updated : c)),
                                    )
                                }
                                onLocalCategoryDelete={(id) =>
                                    setCategories((prev) => prev.filter((c) => c.id !== id))
                                }
                                onLocalServiceAdd={(svc) =>
                                    setServices((prev) => [...prev, svc])
                                }
                                onLocalServiceUpdate={(updated) =>
                                    setServices((prev) =>
                                        prev.map((s) => (s.id === updated.id ? updated : s)),
                                    )
                                }
                                onLocalServiceDelete={(id) =>
                                    setServices((prev) => prev.filter((s) => s.id !== id))
                                }
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            <AddCategoryForm
                locationId={locationId}
                onAdded={(cat) => setCategories((prev) => [...prev, cat])}
                onError={setError}
            />

            {showApplyModal && (
                <ApplyToAllModal
                    sourceLocationId={locationId}
                    onClose={() => {
                        setShowApplyModal(false);
                        router.refresh();
                    }}
                />
            )}

            {reordering && <p className="text-xs text-ink-muted">Saving order…</p>}
        </div>
    );
}

interface CategoryCardProps {
    category: ServiceCategory;
    services: Service[];
    onError: (msg: string) => void;
    onLocalCategoryUpdate: (updated: ServiceCategory) => void;
    onLocalCategoryDelete: (id: string) => void;
    onLocalServiceAdd: (svc: Service) => void;
    onLocalServiceUpdate: (updated: Service) => void;
    onLocalServiceDelete: (id: string) => void;
}

function CategoryCard({
    category,
    services,
    onError,
    onLocalCategoryUpdate,
    onLocalCategoryDelete,
    onLocalServiceAdd,
    onLocalServiceUpdate,
    onLocalServiceDelete,
}: CategoryCardProps) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(category.name);
    const [description, setDescription] = useState(category.description ?? "");
    const [addingService, setAddingService] = useState(false);
    const [isPending, startTransition] = useTransition();

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    function handleSave() {
        startTransition(async () => {
            const res = await updateCategory({ id: category.id, name, description });
            if (res.ok) {
                onLocalCategoryUpdate({
                    ...category,
                    name: name.trim(),
                    description: description.trim() || null,
                });
                setEditing(false);
            } else {
                onError(res.error ?? "Failed to update category");
            }
        });
    }

    function handleDelete() {
        if (services.length > 0) {
            onError("Delete all services in this category first.");
            return;
        }
        if (!confirm(`Delete category "${category.name}"?`)) return;
        startTransition(async () => {
            const res = await deleteCategory({ id: category.id });
            if (res.ok) {
                onLocalCategoryDelete(category.id);
            } else {
                onError(res.error ?? "Failed to delete category");
            }
        });
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "rounded-lg border border-border bg-white p-4",
                isDragging && "opacity-50",
            )}
        >
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="mt-1 cursor-grab text-ink-muted hover:text-ink"
                    aria-label="Drag to reorder category"
                >
                    <DragHandleIcon />
                </button>

                <div className="min-w-0 flex-1">
                    {editing ? (
                        <div className="space-y-2">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Category name"
                                autoFocus
                            />
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description (optional)"
                            />
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleSave} disabled={isPending}>
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                        setName(category.name);
                                        setDescription(category.description ?? "");
                                        setEditing(false);
                                    }}
                                    disabled={isPending}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h3 className="truncate text-base font-semibold">{category.name}</h3>
                            {category.description && (
                                <p className="text-sm text-ink-muted">{category.description}</p>
                            )}
                        </div>
                    )}
                </div>

                {!editing && (
                    <div className="flex shrink-0 gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(true)}
                            className="text-ink-muted"
                        >
                            Edit
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleDelete}
                            disabled={isPending}
                            className="text-red-600 hover:bg-red-50"
                        >
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            <div className="mt-3 ml-4 space-y-2 sm:ml-9">
                <SortableContext
                    items={services.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {services.map((svc) => (
                        <ServiceRow
                            key={svc.id}
                            service={svc}
                            onError={onError}
                            onLocalUpdate={onLocalServiceUpdate}
                            onLocalDelete={onLocalServiceDelete}
                        />
                    ))}
                </SortableContext>

                {addingService ? (
                    <AddServiceForm
                        categoryId={category.id}
                        locationId={category.location_id}
                        onCancel={() => setAddingService(false)}
                        onAdded={(svc) => {
                            setAddingService(false);
                            onLocalServiceAdd(svc);
                        }}
                        onError={onError}
                    />
                ) : (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAddingService(true)}
                        className="text-ink-muted"
                    >
                        + Add service
                    </Button>
                )}
            </div>
        </div>
    );
}

interface ServiceRowProps {
    service: Service;
    onError: (msg: string) => void;
    onLocalUpdate: (svc: Service) => void;
    onLocalDelete: (id: string) => void;
}

function ServiceRow({ service, onError, onLocalUpdate, onLocalDelete }: ServiceRowProps) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(service.name);
    const [description, setDescription] = useState(service.description ?? "");
    const [duration, setDuration] = useState(String(service.duration_minutes));
    const [price, setPrice] = useState(String(service.price));
    const [isPending, startTransition] = useTransition();
    const fieldId = useId();

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: service.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    function handleSave() {
        const dur = parseInt(duration, 10);
        const pr = parseFloat(price);
        startTransition(async () => {
            const res = await updateService({
                id: service.id,
                name,
                description,
                durationMinutes: dur,
                price: pr,
            });
            if (res.ok) {
                onLocalUpdate({
                    ...service,
                    name: name.trim(),
                    description: description.trim() || null,
                    duration_minutes: dur,
                    price: pr,
                });
                setEditing(false);
            } else {
                onError(res.error ?? "Failed to update service");
            }
        });
    }

    function handleDelete() {
        if (!confirm(`Delete service "${service.name}"?`)) return;
        startTransition(async () => {
            const res = await deleteService({ id: service.id });
            if (res.ok) {
                onLocalDelete(service.id);
            } else {
                onError(res.error ?? "Failed to delete service");
            }
        });
    }

    if (editing) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="rounded-md border border-brand/40 bg-surface-muted p-3"
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-name`}>Service name</Label>
                        <Input
                            id={`${fieldId}-name`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-description`}>
                            Description (optional)
                        </Label>
                        <Input
                            id={`${fieldId}-description`}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-duration`}>Duration (min)</Label>
                        <Input
                            id={`${fieldId}-duration`}
                            type="number"
                            min={1}
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${fieldId}-price`}>Price (€)</Label>
                        <Input
                            id={`${fieldId}-price`}
                            type="number"
                            min={0}
                            step={0.01}
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                    </div>
                </div>
                <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={isPending}>
                        Save
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                            setName(service.name);
                            setDescription(service.description ?? "");
                            setDuration(String(service.duration_minutes));
                            setPrice(String(service.price));
                            setEditing(false);
                        }}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-white px-3 py-2 text-sm",
                isDragging && "opacity-50",
            )}
        >
            <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="shrink-0 cursor-grab text-ink-muted hover:text-ink"
                    aria-label="Drag to reorder service"
                >
                    <DragHandleIcon />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{service.name}</p>
                    {service.description && (
                        <p className="truncate text-xs text-ink-muted">{service.description}</p>
                    )}
                </div>
            </div>
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                <div className="flex items-center gap-3 text-ink-muted">
                    <span>{service.duration_minutes} min</span>
                    <span>{formatPrice(service.price)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(true)}
                        className="text-ink-muted"
                    >
                        Edit
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDelete}
                        disabled={isPending}
                        className="text-red-600 hover:bg-red-50"
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}

function AddCategoryForm({
    locationId,
    onAdded,
    onError,
}: {
    locationId: string;
    onAdded: (cat: ServiceCategory) => void;
    onError: (msg: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPending, startTransition] = useTransition();

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        startTransition(async () => {
            const res = await createCategory({ locationId, name, description });
            if (res.ok) {
                setName("");
                setDescription("");
                setOpen(false);
                onAdded(res.data as ServiceCategory);
            } else {
                onError(res.error ?? "Failed to create category");
            }
        });
    }

    if (!open) {
        return (
            <Button variant="secondary" onClick={() => setOpen(true)}>
                + Add category
            </Button>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-2 rounded-lg border border-brand/40 bg-surface-muted p-4"
        >
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                autoFocus
                required
            />
            <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
            />
            <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? "Adding…" : "Add"}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                        setName("");
                        setDescription("");
                        setOpen(false);
                    }}
                    disabled={isPending}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function AddServiceForm({
    categoryId,
    locationId,
    onAdded,
    onCancel,
    onError,
}: {
    categoryId: string;
    locationId: string;
    onAdded: (svc: Service) => void;
    onCancel: () => void;
    onError: (msg: string) => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState("30");
    const [price, setPrice] = useState("0");
    const [isPending, startTransition] = useTransition();
    const fieldId = useId();

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        const dur = parseInt(duration, 10);
        const pr = parseFloat(price);
        startTransition(async () => {
            const res = await createService({
                categoryId,
                locationId,
                name,
                description,
                durationMinutes: dur,
                price: pr,
            });
            if (res.ok) {
                onAdded(res.data as Service);
            } else {
                onError(res.error ?? "Failed to create service");
            }
        });
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-md border border-brand/40 bg-surface-muted p-3"
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label htmlFor={`${fieldId}-name`}>Service name</Label>
                    <Input
                        id={`${fieldId}-name`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        required
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor={`${fieldId}-description`}>
                        Description (optional)
                    </Label>
                    <Input
                        id={`${fieldId}-description`}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor={`${fieldId}-duration`}>Duration (min)</Label>
                    <Input
                        id={`${fieldId}-duration`}
                        type="number"
                        min={1}
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor={`${fieldId}-price`}>Price (€)</Label>
                    <Input
                        id={`${fieldId}-price`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                    />
                </div>
            </div>
            <div className="mt-2 flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? "Adding…" : "Add service"}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isPending}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function DragHandleIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="10" cy="3" r="1.2" />
            <circle cx="4" cy="7" r="1.2" />
            <circle cx="10" cy="7" r="1.2" />
            <circle cx="4" cy="11" r="1.2" />
            <circle cx="10" cy="11" r="1.2" />
        </svg>
    );
}
