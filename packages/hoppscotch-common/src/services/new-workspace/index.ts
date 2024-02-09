import { Service } from "dioc"
import {
  Component,
  Ref,
  computed,
  markRaw,
  shallowReactive,
  shallowRef,
  watch,
} from "vue"
import { WorkspaceProvider } from "./provider"
import { HandleRef } from "./handle"
import * as E from "fp-ts/Either"
import { Workspace, WorkspaceCollection, WorkspaceRequest } from "./workspace"
import { RESTCollectionChildrenView, RootRESTCollectionView } from "./view"
import { HoppCollection, HoppRESTRequest } from "@hoppscotch/data"

export type WorkspaceError<ServiceErr> =
  | { type: "SERVICE_ERROR"; error: ServiceErr }
  | { type: "PROVIDER_ERROR"; error: unknown }

export class NewWorkspaceService extends Service {
  public static readonly ID = "NEW_WORKSPACE_SERVICE"

  private registeredProviders = shallowReactive(
    new Map<string, WorkspaceProvider>()
  )

  public activeWorkspaceHandle: Ref<HandleRef<Workspace> | undefined> =
    shallowRef()

  public activeWorkspaceDecor = computed(() => {
    if (this.activeWorkspaceHandle.value?.value.type !== "ok") {
      return undefined
    }

    return this.registeredProviders.get(
      this.activeWorkspaceHandle.value.value.data.providerID
    )!.workspaceDecor
  })

  public workspaceSelectorComponents = computed(() => {
    const items: Component[] = []

    const sortedProviders = Array.from(this.registeredProviders.values()).sort(
      (a, b) =>
        (b.workspaceDecor?.value.workspaceSelectorPriority ?? 0) -
        (a.workspaceDecor?.value.workspaceSelectorPriority ?? 0)
    )

    for (const workspace of sortedProviders) {
      if (workspace.workspaceDecor?.value?.workspaceSelectorComponent) {
        items.push(workspace.workspaceDecor.value.workspaceSelectorComponent)
      }
    }

    return items
  })

  constructor() {
    super()

    // Watch for situations where the handle is invalidated
    // so the active workspace handle definition can be invalidated
    watch(
      () => {
        return this.activeWorkspaceHandle.value
          ? [
              this.activeWorkspaceHandle.value,
              this.activeWorkspaceHandle.value.value,
            ]
          : [this.activeWorkspaceHandle.value]
      },
      () => {
        if (!this.activeWorkspaceHandle.value) return

        if (this.activeWorkspaceHandle.value.value.type === "invalid") {
          this.activeWorkspaceHandle.value = undefined
        }
      },
      { deep: true }
    )
  }

  public async getWorkspaceHandle(
    providerID: string,
    workspaceID: string
  ): Promise<
    E.Either<WorkspaceError<"INVALID_PROVIDER">, HandleRef<Workspace>>
  > {
    const provider = this.registeredProviders.get(providerID)

    if (!provider) {
      return Promise.resolve(
        E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" as const })
      )
    }

    const handleResult = await provider.getWorkspaceHandle(workspaceID)

    if (E.isLeft(handleResult)) {
      return E.left({ type: "PROVIDER_ERROR", error: handleResult.left })
    }

    return E.right(handleResult.right)
  }

  public async getCollectionHandle(
    workspaceHandle: HandleRef<Workspace>,
    collectionID: string
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<WorkspaceCollection>
    >
  > {
    if (workspaceHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      workspaceHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.getCollectionHandle(
      workspaceHandle,
      collectionID
    )

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async getRequestHandle(
    workspaceHandle: HandleRef<Workspace>,
    requestID: string
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<WorkspaceRequest>
    >
  > {
    if (workspaceHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      workspaceHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.getRequestHandle(workspaceHandle, requestID)

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async createRESTRootCollection(
    workspaceHandle: HandleRef<Workspace>,
    collectionName: string,
    newCollectionID: string
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<WorkspaceCollection>
    >
  > {
    if (workspaceHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      workspaceHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.createRESTRootCollection(
      workspaceHandle,
      collectionName,
      newCollectionID
    )

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async createRESTChildCollection(
    parentCollectionHandle: HandleRef<WorkspaceCollection>,
    collectionName: string
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<WorkspaceCollection>
    >
  > {
    if (parentCollectionHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      parentCollectionHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.createRESTChildCollection(
      parentCollectionHandle,
      collectionName
    )

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async editRESTCollection(
    collectionHandle: HandleRef<WorkspaceCollection>,
    updatedCollection: HoppCollection
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<boolean>
    >
  > {
    if (collectionHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      collectionHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.editRESTCollection(
      collectionHandle,
      updatedCollection
    )

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async removeRESTRootCollection(
    collectionHandle: HandleRef<WorkspaceCollection>
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<boolean>
    >
  > {
    if (collectionHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      collectionHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.removeRESTRootCollection(collectionHandle)

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async removeRESTChildCollection(
    parentCollectionHandle: HandleRef<WorkspaceCollection>
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<boolean>
    >
  > {
    if (parentCollectionHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      parentCollectionHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.removeRESTChildCollection(
      parentCollectionHandle
    )

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async createRESTRequest(
    parentCollectionHandle: HandleRef<WorkspaceCollection>,
    requestName: string,
    openInNewTab: boolean
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<WorkspaceRequest>
    >
  > {
    if (parentCollectionHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      parentCollectionHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.createRESTRequest(
      parentCollectionHandle,
      requestName,
      openInNewTab
    )

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async removeRESTRequest(
    requestHandle: HandleRef<WorkspaceRequest>
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<boolean>
    >
  > {
    if (requestHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      requestHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.removeRESTRequest(requestHandle)

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async updateRESTRequest(
    requestHandle: HandleRef<WorkspaceRequest>,
    updatedRequest: HoppRESTRequest
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<boolean>
    >
  > {
    if (requestHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      requestHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.updateRESTRequest(
      requestHandle,
      updatedRequest
    )

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async getRESTCollectionChildrenView(
    collectionHandle: HandleRef<WorkspaceCollection>
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<RESTCollectionChildrenView>
    >
  > {
    if (collectionHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      collectionHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result =
      await provider.getRESTCollectionChildrenView(collectionHandle)

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public async getRESTRootCollectionView(
    workspaceHandle: HandleRef<Workspace>
  ): Promise<
    E.Either<
      WorkspaceError<"INVALID_HANDLE" | "INVALID_PROVIDER">,
      HandleRef<RootRESTCollectionView>
    >
  > {
    if (workspaceHandle.value.type === "invalid") {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_HANDLE" })
    }

    const provider = this.registeredProviders.get(
      workspaceHandle.value.data.providerID
    )

    if (!provider) {
      return E.left({ type: "SERVICE_ERROR", error: "INVALID_PROVIDER" })
    }

    const result = await provider.getRESTRootCollectionView(workspaceHandle)

    if (E.isLeft(result)) {
      return E.left({ type: "PROVIDER_ERROR", error: result.left })
    }

    return E.right(result.right)
  }

  public registerWorkspaceProvider(provider: WorkspaceProvider) {
    if (this.registeredProviders.has(provider.providerID)) {
      console.warn(
        "Ignoring attempt to re-register workspace provider that is already existing:",
        provider
      )
      return
    }

    this.registeredProviders.set(provider.providerID, markRaw(provider))
  }
}
