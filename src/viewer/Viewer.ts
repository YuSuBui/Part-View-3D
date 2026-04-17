import {
  AbstractMesh,
  ArcRotateCamera,
  BoundingInfo,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  HighlightLayer,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { Nullable } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import '@babylonjs/loaders/OBJ'
import '@babylonjs/loaders/STL'

export type SelectionInfo = {
  name: string
  materialName: string
  vertexCount: number
}

type ViewerCallbacks = {
  onLoading: (isLoading: boolean) => void
  onError: (message: string | null) => void
  onSelectionChange: (selection: SelectionInfo | null) => void
}

type CameraSnapshot = {
  alpha: number
  beta: number
  radius: number
  target: Vector3
}

const MIN_BETA = 0.35
const MAX_BETA = Math.PI / 2 - 0.08

export class Viewer {
  private readonly engine: Engine
  private readonly scene: Scene
  private readonly camera: ArcRotateCamera
  private readonly highlightLayer: HighlightLayer
  private readonly callbacks: ViewerCallbacks
  private modelMeshes: AbstractMesh[] = []
  private selectedMesh: Nullable<Mesh> = null
  private defaultCameraSnapshot: Nullable<CameraSnapshot> = null
  private readonly handleResize = () => this.engine.resize()

  constructor(canvas: HTMLCanvasElement, callbacks: ViewerCallbacks) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true })
    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0.02, 0.02, 0.02, 1)
    this.callbacks = callbacks

    this.camera = new ArcRotateCamera(
      'viewer-camera',
      Math.PI / 3,
      Math.PI / 3,
      10,
      Vector3.Zero(),
      this.scene,
    )
    this.camera.attachControl(canvas, true)
    this.camera.lowerRadiusLimit = 1
    this.camera.upperRadiusLimit = 50
    this.camera.wheelPrecision = 24
    this.camera.pinchPrecision = 140
    this.camera.inertia = 0.7

    const hemi = new HemisphericLight(
      'hemi',
      new Vector3(0, 1, 0),
      this.scene,
    )
    hemi.intensity = 0.5

    const dir = new DirectionalLight(
      'dir',
      new Vector3(-0.5, -1, -0.5),
      this.scene,
    )
    dir.position = new Vector3(5, 8, 5)
    dir.intensity = 1.0

    const rim = new DirectionalLight(
      'rim',
      new Vector3(0.5, -1, 0.5),
      this.scene,
    )
    rim.position = new Vector3(-5, 6, -5)
    rim.intensity = 0.5

    this.createLightPanels(this.scene)

    this.highlightLayer = new HighlightLayer(
      'selection-highlight',
      this.scene,
    )
    this.setupPicking()
    this.engine.runRenderLoop(() => this.scene.render())
    window.addEventListener('resize', this.handleResize)
  }

  async loadModel(modelUrl: string): Promise<void> {
    this.callbacks.onError(null)
    this.callbacks.onLoading(true)
    this.clearSelection()
    this.disposeCurrentModel()

    try {
      const result = await SceneLoader.ImportMeshAsync('', '', modelUrl, this.scene)
      this.modelMeshes = result.meshes
      const meshes = result.meshes.filter(
        (mesh): mesh is Mesh =>
          mesh instanceof Mesh &&
          mesh.isVisible &&
          mesh.isEnabled() &&
          mesh.getTotalVertices() > 0,
      )

      if (!meshes.length) {
        throw new Error('Model has no visible meshes to render.')
      }

      meshes.forEach((mesh) => {
        mesh.isPickable = true
      })

      this.fitCameraToMeshes(meshes)
    } catch {
      this.callbacks.onError(
        'Failed to load model. Check the GLB path or network and try again.',
      )
    } finally {
      this.callbacks.onLoading(false)
    }
  }

  resetView(): void {
    if (!this.defaultCameraSnapshot) {
      return
    }

    const snapshot = this.defaultCameraSnapshot
    this.camera.alpha = snapshot.alpha
    this.camera.beta = snapshot.beta
    this.camera.radius = snapshot.radius
    this.camera.setTarget(snapshot.target.clone())
  }

  clearSelection(): void {
    if (this.selectedMesh) {
      this.highlightLayer.removeMesh(this.selectedMesh)
      this.selectedMesh = null
    }

    this.callbacks.onSelectionChange(null)
  }

  dispose(): void {
    this.disposeCurrentModel()
    window.removeEventListener('resize', this.handleResize)
    this.highlightLayer.dispose()
    this.camera.detachControl()
    this.scene.dispose()
    this.engine.dispose()
  }

  private fitCameraToMeshes(meshes: Mesh[]): void {
    const bounds = this.computeBounds(meshes)
    const center = bounds.boundingSphere.centerWorld
    const radiusFromBounds = Math.max(bounds.boundingSphere.radiusWorld, 0.25)
    const size = bounds.boundingBox.extendSizeWorld.scale(2)
    const { alpha, beta } = this.calculateCameraAngles(size)
    const dynamicPadding = this.calculateDynamicPadding(size)
    const fov = Math.max(this.camera.fov, 0.3)
    const fitRadius = (radiusFromBounds * dynamicPadding) / Math.sin(fov / 2)

    this.camera.alpha = alpha
    this.camera.beta = beta
    this.camera.setTarget(center)
    this.camera.radius = fitRadius
    this.camera.lowerRadiusLimit = Math.max(radiusFromBounds * 1.05, fitRadius * 0.6)
    this.camera.upperRadiusLimit = Math.max(
      fitRadius * 1.8,
      this.camera.lowerRadiusLimit + 2,
    )
    this.camera.wheelPrecision = Math.max(fitRadius * 3.5, 12)
    this.camera.pinchPrecision = Math.max(fitRadius * 18, 80)

    this.defaultCameraSnapshot = {
      alpha,
      beta,
      radius: fitRadius,
      target: center.clone(),
    }
  }

  private calculateDynamicPadding(size: Vector3): number {
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const minDim = Math.max(Math.min(size.x, size.y, size.z), 0.001)
    const aspect3d = maxDim / minDim
    const padding = 1.05 + Math.log10(aspect3d) * 0.25

    return Math.min(1.45, Math.max(1.05, padding))
  }

  private calculateCameraAngles(size: Vector3): { alpha: number; beta: number } {
    const horizontalSpan = Math.max(size.x, size.z, 0.001)
    const verticalSpan = Math.max(size.y, 0.001)
    const isXDominant = size.x >= size.z

    // Aim along the longest horizontal axis so elongated models fit better.
    const alphaBase = isXDominant ? Math.PI / 2 : 0
    const alpha = alphaBase + Math.PI / 6

    // Taller models get a slightly higher pitch to keep full framing.
    const verticalRatio = verticalSpan / horizontalSpan
    const beta = Math.min(
      MAX_BETA,
      Math.max(MIN_BETA, Math.PI / 3 + verticalRatio * 0.25),
    )

    return { alpha, beta }
  }

  private computeBounds(meshes: Mesh[]): BoundingInfo {
    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = new Vector3(-Infinity, -Infinity, -Infinity)

    meshes.forEach((mesh) => {
      mesh.computeWorldMatrix(true)
      mesh.refreshBoundingInfo(true)
      const bounding = mesh.getBoundingInfo().boundingBox
      min.minimizeInPlace(bounding.minimumWorld)
      max.maximizeInPlace(bounding.maximumWorld)
    })

    return new BoundingInfo(min, max)
  }

  private setupPicking(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) {
        return
      }

      const pickedMesh = pointerInfo.pickInfo?.pickedMesh
      if (!(pickedMesh instanceof Mesh) || !pickedMesh.isPickable) {
        this.clearSelection()
        return
      }

      this.selectMesh(pickedMesh)
    })
  }

  private selectMesh(mesh: Mesh): void {
    if (this.selectedMesh === mesh) {
      return
    }

    if (this.selectedMesh) {
      this.highlightLayer.removeMesh(this.selectedMesh)
    }

    this.selectedMesh = mesh
    this.highlightLayer.addMesh(mesh, Color3.FromHexString('#40e0d0'))

    this.callbacks.onSelectionChange({
      name: mesh.name || 'Unnamed part',
      materialName: mesh.material?.name ?? 'N/A',
      vertexCount: mesh.getTotalVertices(),
    })
  }

  private disposeCurrentModel(): void {
    if (!this.modelMeshes.length) {
      return
    }

    this.modelMeshes.forEach((mesh) => {
      mesh.dispose(false, true)
    })
    this.modelMeshes = []
    this.selectedMesh = null
    this.callbacks.onSelectionChange(null)
  }

  private createLightPanels(scene: Scene): void {
    const createPanel = (x: number, z: number) => {
      const panel = MeshBuilder.CreatePlane(
        'panel',
        { width: 6, height: 1 },
        scene,
      )

      panel.position = new Vector3(x, 15, z)
      panel.rotation.x = Math.PI / 2

      const mat = new StandardMaterial('mat', scene)
      mat.emissiveColor = new Color3(1, 1, 1)
      mat.disableLighting = true

      panel.material = mat
    }

    createPanel(0, 0)
    createPanel(0, 2)
    createPanel(0, -2)
    createPanel(2, 0)
    createPanel(-2, 0)
  }
}
