// Base class for all kubernetes objects

import moment from "moment";
import { KubeJsonApiData, KubeJsonApiDataList } from "./kube-json-api";
import { autobind, formatDuration } from "../utils";
import { ItemObject } from "../item.store";
import { apiKube } from "./index";
import { JsonApiParams } from "./json-api";
import { resourceApplierApi } from "./endpoints/resource-applier.api";
import { hasOwnProperties, hasOwnProperty } from "../../common/utils/type-narrowing";

export type IKubeObjectConstructor<T extends KubeObject = any> = (new (data: KubeJsonApiData | any) => T) & {
  kind?: string;
  namespaced?: boolean;
  apiBase?: string;
};

export interface IKubeObjectMetadata {
  uid: string;
  name: string;
  namespace?: string;
  creationTimestamp: string;
  resourceVersion: string;
  selfLink: string;
  deletionTimestamp?: string;
  finalizers?: string[];
  continue?: string; // provided when used "?limit=" query param to fetch objects list
  labels?: {
    [label: string]: string;
  };
  annotations?: {
    [annotation: string]: string;
  };
  ownerReferences?: {
    apiVersion: string;
    kind: string;
    name: string;
    uid: string;
    controller: boolean;
    blockOwnerDeletion: boolean;
  }[];
}

export type IKubeMetaField = keyof IKubeObjectMetadata;

@autobind()
export class KubeObject implements ItemObject {
  static readonly kind: string;
  static readonly namespaced: boolean;

  static create(data: any) {
    return new KubeObject(data);
  }

  static isNonSystem(item: KubeJsonApiData | KubeObject) {
    return !item.metadata.name.startsWith("system:");
  }

  static isJsonApiData(object: unknown): object is KubeJsonApiData {
    if (!object || typeof object !== "object") {
      return false;
    }

    if (!hasOwnProperties(object, "kind", "apiVersion", "metadata")) {
      return false;
    }

    if (typeof object.kind !== "string"
      || typeof object.apiVersion !== "string"
      || !object.metadata || typeof object.metadata !== "object"
    ) {
      return false;
    }

    const { metadata } = object;

    if (!hasOwnProperties(metadata, "uid", "name", "resourceVersion", "selfLink")) {
      return false;
    }

    if (typeof metadata.uid !== "string"
      || typeof metadata.name !== "string"
      || typeof metadata.resourceVersion !== "string"
      || typeof metadata.selfLink !== "string"
    ) {
      return false;
    }

    if (hasOwnProperty(metadata, "namespace")
      && typeof metadata.namespace !== "string"
      && typeof metadata.namespace !== "undefined"
    ) {
      return false;
    }

    if (hasOwnProperty(metadata, "creationTimestamp")
      && typeof metadata.creationTimestamp !== "string"
      && typeof metadata.creationTimestamp !== "undefined"
    ) {
      return false;
    }

    if (hasOwnProperty(metadata, "continue")
      && typeof metadata.continue !== "string"
      && typeof metadata.continue !== "undefined"
    ) {
      return false;
    }

    if (hasOwnProperty(metadata, "finalizers")
      && typeof metadata.finalizers !== "undefined"
      && !(Array.isArray(metadata.finalizers)
      && metadata.finalizers.every(finalizer => typeof finalizer === "string"))
    ) {
      return false;
    }

    labels: if (hasOwnProperty(metadata, "labels")) {
      if (typeof metadata.labels === "undefined" || (typeof metadata.labels === "object" && metadata.labels !== null && !Array.isArray(metadata.labels))) {
        if (metadata.labels) {
          for (const label in metadata.labels) {
            if (!hasOwnProperty(metadata.labels, label) || typeof metadata.labels[label] !== "string") {
              return false;
            }
          }

          break labels;
        }
      }

      return false;
    }

    annotations: if (hasOwnProperty(metadata, "annotations")) {
      if (typeof metadata.annotations === "undefined" || (typeof metadata.annotations === "object" && metadata.annotations !== null && !Array.isArray(metadata.annotations))) {
        if (metadata.annotations) {
          for (const annotation in metadata.annotations) {
            if (!hasOwnProperty(metadata.annotations, annotation) || typeof metadata.annotations[annotation] !== "string") {
              return false;
            }
          }

          break annotations;
        }
      }

      return false;
    }

    return true;
  }

  static isPartialJsonApiData(object: unknown): object is Partial<KubeJsonApiData> {
    if (!object || typeof object !== "object") {
      return false;
    }

    if (hasOwnProperty(object, "kind")
      && typeof object.kind !== "string"
      && typeof object.kind !== "undefined"
    ) {
      return false;
    }

    if (hasOwnProperty(object, "apiVersion")
      && typeof object.apiVersion !== "string"
      && typeof object.apiVersion !== "undefined"
    ) {
      return false;
    }

    if (hasOwnProperty(object, "metadata")) {
      if (!object.metadata || typeof object.metadata !== "object") {
        return false;
      }

      const { metadata } = object;

      if (!hasOwnProperties(metadata, "uid", "name", "resourceVersion", "selfLink")) {
        return false;
      }

      if (typeof metadata.uid !== "string"
        || typeof metadata.name !== "string"
        || typeof metadata.resourceVersion !== "string"
        || typeof metadata.selfLink !== "string"
      ) {
        return false;
      }

      if (hasOwnProperty(metadata, "namespace")
        && typeof metadata.namespace !== "string"
        && typeof metadata.namespace !== "undefined"
      ) {
        return false;
      }

      if (hasOwnProperty(metadata, "creationTimestamp")
        && typeof metadata.creationTimestamp !== "string"
        && typeof metadata.creationTimestamp !== "undefined"
      ) {
        return false;
      }

      if (hasOwnProperty(metadata, "continue")
        && typeof metadata.continue !== "string"
        && typeof metadata.continue !== "undefined"
      ) {
        return false;
      }

      if (hasOwnProperty(metadata, "finalizers")
        && typeof metadata.finalizers !== "undefined"
        && !(Array.isArray(metadata.finalizers)
          && metadata.finalizers.every(finalizer => typeof finalizer === "string"))
      ) {
        return false;
      }

      labels: if (hasOwnProperty(metadata, "labels")) {
        if (typeof metadata.labels === "undefined" || (typeof metadata.labels === "object" && metadata.labels !== null && !Array.isArray(metadata.labels))) {
          if (metadata.labels) {
            for (const label in metadata.labels) {
              if (!hasOwnProperty(metadata.labels, label) || typeof metadata.labels[label] !== "string") {
                return false;
              }
            }

            break labels;
          }
        }

        return false;
      }

      annotations: if (hasOwnProperty(metadata, "annotations")) {
        if (typeof metadata.annotations === "undefined" || (typeof metadata.annotations === "object" && metadata.annotations !== null && !Array.isArray(metadata.annotations))) {
          if (metadata.annotations) {
            for (const annotation in metadata.annotations) {
              if (!hasOwnProperty(metadata.annotations, annotation) || typeof metadata.annotations[annotation] !== "string") {
                return false;
              }
            }

            break annotations;
          }
        }

        return false;
      }
    }

    return true;
  }

  static isJsonApiDataList<T>(object: unknown, verifyItem:(val: unknown) => val is T): object is KubeJsonApiDataList<T> {
    if (!object || typeof object !== "object") {
      return false;
    }

    if (!hasOwnProperties(object, "kind", "apiVersion", "items", "metadata")) {
      return false;
    }

    if (typeof object.kind !== "string"
      || typeof object.apiVersion !== "string"
      || !object.metadata || typeof object.metadata !== "object"
      || !object.items || !Array.isArray(object.items) || !object.items.every(verifyItem)
    ) {
      return false;
    }

    const { metadata } = object;

    if (!hasOwnProperties(metadata, "resourceVersion", "selfLink")) {
      return false;
    }

    if (typeof metadata.resourceVersion !== "string"
      || typeof metadata.selfLink !== "string"
    ) {
      return false;
    }

    return true;
  }

  static stringifyLabels(labels: { [name: string]: string }): string[] {
    if (!labels) return [];

    return Object.entries(labels).map(([name, value]) => `${name}=${value}`);
  }

  constructor(data: KubeJsonApiData) {
    Object.assign(this, data);
  }

  apiVersion: string;
  kind: string;
  metadata: IKubeObjectMetadata;
  status?: any; // todo: type-safety support

  get selfLink() {
    return this.metadata.selfLink;
  }

  getId() {
    return this.metadata.uid;
  }

  getResourceVersion() {
    return this.metadata.resourceVersion;
  }

  getName() {
    return this.metadata.name;
  }

  getNs() {
    // avoid "null" serialization via JSON.stringify when post data
    return this.metadata.namespace || undefined;
  }

  // todo: refactor with named arguments
  getAge(humanize = true, compact = true, fromNow = false) {
    if (fromNow) {
      return moment(this.metadata.creationTimestamp).fromNow();
    }
    const diff = new Date().getTime() - new Date(this.metadata.creationTimestamp).getTime();

    if (humanize) {
      return formatDuration(diff, compact);
    }

    return diff;
  }

  getFinalizers(): string[] {
    return this.metadata.finalizers || [];
  }

  getLabels(): string[] {
    return KubeObject.stringifyLabels(this.metadata.labels);
  }

  getAnnotations(filter = false): string[] {
    const labels = KubeObject.stringifyLabels(this.metadata.annotations);

    return filter ? labels.filter(label => {
      const skip = resourceApplierApi.annotations.some(key => label.startsWith(key));

      return !skip;
    }) : labels;
  }

  getOwnerRefs() {
    const refs = this.metadata.ownerReferences || [];

    return refs.map(ownerRef => ({
      ...ownerRef,
      namespace: this.getNs(),
    }));
  }

  getSearchFields() {
    const { getName, getId, getNs, getAnnotations, getLabels } = this;

    return [
      getName(),
      getNs(),
      getId(),
      ...getLabels(),
      ...getAnnotations(true),
    ];
  }

  toPlainObject(): object {
    return JSON.parse(JSON.stringify(this));
  }

  // use unified resource-applier api for updating all k8s objects
  async update<T extends KubeObject>(data: Partial<T>) {
    return resourceApplierApi.update<T>({
      ...this.toPlainObject(),
      ...data,
    });
  }

  delete(params?: JsonApiParams) {
    return apiKube.del(this.selfLink, params);
  }
}
